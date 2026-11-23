export type Strategy = 'none' | 'single-flight' | 'jitter' | 'early' | 'stale';

export const STRATEGIES: readonly { id: Strategy; label: string; summary: string }[] = [
  {
    id: 'none',
    label: '일반 캐시',
    summary: '키가 없으면 요청마다 DB 에 가요. 만료 순간 기다리던 요청이 모두 DB 로 몰려요.',
  },
  {
    id: 'single-flight',
    label: '요청 병합',
    summary: '같은 키를 채우는 DB 조회는 하나만 나가요. 나머지 요청은 그 결과를 같이 기다려요.',
  },
  {
    id: 'jitter',
    label: 'TTL 지터',
    summary:
      '만료 시간을 30% 안에서 무작위로 흩어요. 키가 많을 때 같은 순간에 만료되는 키가 줄어요. 한 키의 몰림은 그대로예요.',
  },
  {
    id: 'early',
    label: '확률적 조기 갱신',
    summary: '만료 전에 확률로 요청 한 개가 갱신을 맡아요. 갱신 중에는 다른 요청이 옛 값을 그대로 받아요.',
  },
  {
    id: 'stale',
    label: '옛 값 먼저 주기',
    summary: '만료된 값도 TTL 만큼 더 주고, 뒤에서 한 번만 갱신해요. 읽는 쪽은 기다리지 않아요.',
  },
];

export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
export const DURATION_TICKS = 600;
export const JITTER_SPREAD = 0.3;
export const XFETCH_BETA = 1;

export interface Config {
  readonly strategy: Strategy;
  /** 핫 키 전체에 들어오는 초당 요청 수 */
  readonly rate: number;
  /** 같은 시점에 채워진 키 개수. 요청은 키 중 하나를 무작위로 골라요 */
  readonly keys: number;
  readonly ttlSec: number;
  /** DB 조회 한 번이 걸리는 시간 */
  readonly dbMs: number;
  readonly seed: number;
}

export interface Result {
  readonly requests: number;
  /** 신선한 캐시에서 바로 답한 요청 */
  readonly hits: number;
  /** 만료됐지만 옛 값을 돌려준 요청 */
  readonly staleServed: number;
  /** DB 조회가 끝나기를 기다린 요청 */
  readonly blocked: number;
  readonly dbQueries: number;
  readonly peakConcurrentDb: number;
  /** 가장 오래 기다린 요청의 틱 수 */
  readonly maxWaitTicks: number;
  /** 틱마다 시작한 DB 조회 수 */
  readonly dbPerTick: readonly number[];
  /** (신선한 응답 + 옛 응답) / 전체 요청 */
  readonly hitRatio: number;
}

interface Load {
  readonly key: number;
  readonly done: number;
  readonly waiters: number[];
}

/** 같은 시드면 같은 순서로 난수를 뽑아요 */
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

export function simulate(config: Config): Result {
  const ttlTicks = Math.max(1, Math.round((config.ttlSec * 1000) / TICK_MS));
  const latTicks = Math.max(1, Math.round(config.dbMs / TICK_MS));
  const arrivals = mulberry32(config.seed);
  const ttlRandom = mulberry32(config.seed ^ 0x9e3779b9);
  const earlyRandom = mulberry32(config.seed ^ 0x85ebca6b);

  const nextTtl = (): number => {
    if (config.strategy !== 'jitter') return ttlTicks;
    const spread = 1 + JITTER_SPREAD * (2 * ttlRandom() - 1);
    return Math.max(1, Math.round(ttlTicks * spread));
  };

  const expiresAt: number[] = Array.from({ length: config.keys }, () => nextTtl());
  const loading: (Load | undefined)[] = Array.from({ length: config.keys }, () => undefined);
  const dbPerTick: number[] = new Array<number>(DURATION_TICKS).fill(0);
  const perTick = config.rate / TICKS_PER_SECOND;

  let active: Load[] = [];
  let requests = 0;
  let hits = 0;
  let staleServed = 0;
  let blocked = 0;
  let dbQueries = 0;
  let peak = 0;
  let maxWait = 0;

  const startLoad = (key: number, t: number, waiter: number | null): Load => {
    const load: Load = { key, done: t + latTicks, waiters: waiter === null ? [] : [waiter] };
    active.push(load);
    dbQueries += 1;
    dbPerTick[t] += 1;
    return load;
  };

  const refreshInBackground = (key: number, t: number) => {
    loading[key] = startLoad(key, t, null);
  };

  const joinOrStart = (key: number, t: number) => {
    blocked += 1;
    const inflight = loading[key];
    if (inflight) inflight.waiters.push(t);
    else loading[key] = startLoad(key, t, t);
  };

  const earlyRefreshDue = (key: number, t: number): boolean => {
    const u = Math.max(earlyRandom(), Number.EPSILON);
    return t - latTicks * XFETCH_BETA * Math.log(u) >= expiresAt[key];
  };

  const handle = (key: number, t: number) => {
    requests += 1;
    const fresh = t < expiresAt[key];
    switch (config.strategy) {
      case 'none':
      case 'jitter':
        if (fresh) {
          hits += 1;
          return;
        }
        blocked += 1;
        startLoad(key, t, t);
        return;
      case 'single-flight':
        if (fresh) {
          hits += 1;
          return;
        }
        joinOrStart(key, t);
        return;
      case 'early':
        if (fresh) {
          hits += 1;
          if (!loading[key] && earlyRefreshDue(key, t)) refreshInBackground(key, t);
          return;
        }
        joinOrStart(key, t);
        return;
      case 'stale':
        if (fresh) {
          hits += 1;
          return;
        }
        if (t < expiresAt[key] + ttlTicks) {
          staleServed += 1;
          if (!loading[key]) refreshInBackground(key, t);
          return;
        }
        joinOrStart(key, t);
        return;
    }
  };

  const complete = (t: number) => {
    const finished = active.filter((load) => load.done === t);
    if (finished.length === 0) return;
    active = active.filter((load) => load.done !== t);
    for (const load of finished) {
      expiresAt[load.key] = t + nextTtl();
      if (loading[load.key] === load) loading[load.key] = undefined;
      for (const arrived of load.waiters) maxWait = Math.max(maxWait, t - arrived);
    }
  };

  for (let t = 0; t < DURATION_TICKS; t += 1) {
    complete(t);
    const base = Math.floor(perTick);
    const count = base + (arrivals() < perTick - base ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      handle(Math.floor(arrivals() * config.keys), t);
    }
    peak = Math.max(peak, active.length);
  }

  return {
    requests,
    hits,
    staleServed,
    blocked,
    dbQueries,
    peakConcurrentDb: peak,
    maxWaitTicks: maxWait,
    dbPerTick,
    hitRatio: requests === 0 ? 0 : (hits + staleServed) / requests,
  };
}

/** 틱 단위 DB 조회를 1초 막대로 묶어요 */
export function perSecond(dbPerTick: readonly number[]): number[] {
  const seconds: number[] = [];
  for (let i = 0; i < dbPerTick.length; i += TICKS_PER_SECOND) {
    seconds.push(dbPerTick.slice(i, i + TICKS_PER_SECOND).reduce((sum, n) => sum + n, 0));
  }
  return seconds;
}
