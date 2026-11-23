export type Strategy = 'single' | 'sharded' | 'buffered' | 'log';
export type Method = 'post' | 'put';
type Kind = 'like' | 'unlike';

export const STRATEGIES: readonly Strategy[] = ['single', 'sharded', 'buffered', 'log'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  single: '한 행에 바로 UPDATE',
  sharded: '카운터를 N 조각으로 나누기',
  buffered: 'Redis 에 모았다가 주기적으로 반영',
  log: '이벤트 로그에 쌓고 주기적으로 집계',
};
export const STRATEGY_HINT: Record<Strategy, string> = {
  single: '요청마다 같은 행을 UPDATE 해요. 행 락을 차례로 기다리니 인기 글일수록 줄이 길어져요.',
  sharded: '카운터를 여러 행으로 나눠 요청을 나눠 받아요. 행마다 줄이 짧아지지만, 총합을 읽을 때 조각을 모두 더해요.',
  buffered: 'Redis INCR 로 메모리에 쌓고 F 틱마다 한 번만 DB 에 반영해요. 반영 전 장애가 나면 쌓인 값을 잃어요.',
  log: '좋아요 이벤트를 행으로 쌓고 F 틱마다 집계해요. 이벤트가 남아서 장애가 나도 집계를 다시 만들 수 있어요.',
};

export const METHODS: readonly Method[] = ['post', 'put'];
export const METHOD_LABEL: Record<Method, string> = {
  post: 'POST 로 누를 때마다 +1',
  put: 'PUT 으로 좋아요 상태 설정',
};
export const METHOD_HINT: Record<Method, string> = {
  post: '서버가 요청을 받을 때마다 숫자를 바꿔요. 더블 탭이나 재시도가 그대로 숫자가 돼요.',
  put: '좋아요 상태를 한 번만 설정해요. 이미 좋아요인 사용자의 요청은 숫자를 바꾸지 않아요.',
};

export const SPIKE_TICKS = 40;
export const HORIZON = 120;
/** 가정: 한 행이 틱마다 락을 잡고 처리할 수 있는 쓰기 수. 숫자 자체보다 비율을 보세요. */
export const ROW_CAPACITY = 40;
export const USERS = 2000;

export interface Params {
  readonly strategy: Strategy;
  readonly method: Method;
  readonly shards: number;
  readonly flushEvery: number;
  readonly likesPerTick: number;
  readonly unlikeRate: number;
  readonly doubleTapRate: number;
  /** buffered 에서만 쓰여요. null 이면 장애가 나지 않아요. */
  readonly crashTick: number | null;
  readonly seed: number;
}

export interface Request {
  readonly tick: number;
  readonly user: number;
  readonly kind: Kind;
  readonly dup: boolean;
}

export interface Result {
  readonly requests: readonly Request[];
  readonly truthByTick: readonly number[];
  readonly displayedByTick: readonly number[];
  readonly lagByTick: readonly number[];
  readonly deltaByTick: readonly number[];
  readonly peakQueue: number;
  readonly avgWait: number;
  readonly peakRowWrites: number;
  readonly hotRowWrites: number;
  readonly lost: number;
  readonly finalTruth: number;
  readonly finalDisplayed: number;
  readonly drift: number;
  readonly duplicateRequests: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 사용자가 실제로 누른 의도. 더블 탭은 같은 요청을 한 번 더 보내요. */
export function buildRequests(p: Pick<Params, 'likesPerTick' | 'unlikeRate' | 'doubleTapRate' | 'seed'>): Request[] {
  const rnd = mulberry32(p.seed);
  const liked = new Set<number>();
  const out: Request[] = [];
  for (let t = 0; t < SPIKE_TICKS; t++) {
    for (let k = 0; k < p.likesPerTick; k++) {
      const user = Math.floor(rnd() * USERS);
      let kind: Kind;
      if (!liked.has(user)) kind = 'like';
      else if (rnd() < p.unlikeRate) kind = 'unlike';
      else continue;
      if (kind === 'like') liked.add(user);
      else liked.delete(user);
      out.push({ tick: t, user, kind, dup: false });
      if (rnd() < p.doubleTapRate) out.push({ tick: t, user, kind, dup: true });
    }
  }
  return out;
}

/** 서버가 숫자에 적용하는 변화량. POST 는 요청마다, PUT 은 상태가 실제로 바뀔 때만 1 이에요. */
export function serverDeltas(requests: readonly Request[], method: Method): number[] {
  if (method === 'post') return requests.map((r) => (r.kind === 'like' ? 1 : -1));
  const set = new Set<number>();
  return requests.map((r) => {
    if (r.kind === 'like') {
      if (set.has(r.user)) return 0;
      set.add(r.user);
      return 1;
    }
    if (!set.has(r.user)) return 0;
    set.delete(r.user);
    return -1;
  });
}

interface Write {
  readonly delta: number;
  readonly at: number;
}

class HotRow {
  private queue: Write[] = [];
  applied = 0;
  served = 0;
  waitTotal = 0;
  writes = 0;
  peak = 0;

  push(w: Write): void {
    this.queue.push(w);
    this.writes += 1;
  }

  drain(t: number): void {
    for (let k = 0; k < ROW_CAPACITY && this.queue.length > 0; k++) {
      const w = this.queue.shift() as Write;
      this.applied += w.delta;
      this.served += 1;
      this.waitTotal += t - w.at;
    }
    this.peak = Math.max(this.peak, this.queue.length);
  }
}

export function simulate(p: Params): Result {
  const requests = buildRequests(p);
  const deltas = serverDeltas(requests, p.method);
  const byTick: number[][] = Array.from({ length: HORIZON + 1 }, () => []);
  requests.forEach((r, i) => byTick[r.tick].push(i));

  const rows = Array.from({ length: p.strategy === 'sharded' ? p.shards : 1 }, () => new HotRow());
  const truth = new Set<number>();
  const truthByTick: number[] = [];
  const displayedByTick: number[] = [];
  const lagByTick: number[] = [];
  const deltaByTick: number[] = [];
  const buffered = p.strategy === 'buffered' || p.strategy === 'log';
  let pending = 0;
  let lost = 0;

  for (let t = 0; t <= HORIZON; t++) {
    let tickDelta = 0;
    for (const i of byTick[t]) {
      const r = requests[i];
      const d = deltas[i];
      tickDelta += d;
      if (r.kind === 'like') truth.add(r.user);
      else truth.delete(r.user);

      if (buffered) {
        pending += d;
      } else if (d !== 0) {
        const idx = p.strategy === 'sharded' ? r.user % rows.length : 0;
        rows[idx].push({ delta: d, at: t });
      }
    }
    deltaByTick.push(tickDelta);

    if (buffered) {
      if (p.strategy === 'buffered' && p.crashTick === t) {
        lost += pending;
        pending = 0;
      }
      if (t % p.flushEvery === p.flushEvery - 1 && pending !== 0) {
        rows[0].push({ delta: pending, at: t });
        pending = 0;
      }
    }

    rows.forEach((row) => row.drain(t));
    const displayed = rows.reduce((sum, row) => sum + row.applied, 0);
    truthByTick.push(truth.size);
    displayedByTick.push(displayed);
    lagByTick.push(truth.size - displayed);
  }

  const served = rows.reduce((sum, row) => sum + row.served, 0);
  const waitTotal = rows.reduce((sum, row) => sum + row.waitTotal, 0);
  const finalTruth = truth.size;
  const finalDisplayed = displayedByTick[HORIZON];

  return {
    requests,
    truthByTick,
    displayedByTick,
    lagByTick,
    deltaByTick,
    peakQueue: Math.max(0, ...rows.map((row) => row.peak)),
    avgWait: served === 0 ? 0 : waitTotal / served,
    peakRowWrites: Math.max(0, ...rows.map((row) => row.writes)),
    hotRowWrites: rows.reduce((sum, row) => sum + row.writes, 0),
    lost,
    finalTruth,
    finalDisplayed,
    drift: finalDisplayed - finalTruth,
    duplicateRequests: requests.filter((r) => r.dup).length,
  };
}

/** 1만 이상은 만 단위로 줄이고, 소수 한 자리까지 보여요. */
export function formatCount(n: number): string {
  if (n < 10000) return String(n);
  return `${(n / 10000).toFixed(1)}만`;
}
