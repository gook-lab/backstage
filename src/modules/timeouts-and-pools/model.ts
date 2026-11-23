// 타임아웃 · 커넥션 풀 시뮬레이터 모델. 모든 함수는 순수해요. 같은 설정과 시드면 항상 같은 결과가 나와요.
// 시간은 TICK_MS 단위로 진행해요. 앞단(클라이언트 · 프록시)은 시간이 되면 기다리기를 멈추고, 앱은 DB 커넥션을 빌려 쿼리를 실행해요.

/** 시뮬레이터 시간 간격(ms). 설정값이 모두 이 단위의 배수라 틱에 딱 맞아요 */
export const TICK_MS = 10;
/** 요청이 도착하는 구간(ms). 그 뒤에도 남은 시도를 마무리하도록 시뮬레이션을 더 돌려요 */
export const ARRIVAL_MS = 20_000;
/** 실패한 클라이언트가 다시 보내기까지 기다리는 시간(ms). 백오프를 단순하게 고정했어요 */
export const RETRY_DELAY_MS = 300;
const END_MS = 160_000;

export interface PoolScenario {
  /** 초당 요청 수. 간격을 고르게 두고 도착시켜요 */
  rps: number;
  /** DB 커넥션 풀 크기 */
  poolSize: number;
  /** 보통 쿼리 시간(ms) */
  avgQueryMs: number;
  /** 느린 쿼리 비율(0~1) */
  slowRatio: number;
  /** 느린 쿼리 시간(ms) */
  slowQueryMs: number;
  /** 클라이언트 타임아웃(ms) */
  clientTimeoutMs: number;
  /** 프록시가 앱 응답을 기다리는 시간(ms). 프록시 504 의 기준이에요 */
  proxyTimeoutMs: number;
  /** DB statement_timeout(ms). 쿼리가 실행을 시작한 뒤부터 재요 */
  dbTimeoutMs: number;
  /** 실패한 시도를 다시 보내는 횟수 */
  retries: number;
  /** true 면 앞단이 기다리기를 멈출 때 대기 중이거나 실행 중인 DB 작업도 취소해요 */
  cancelOnGiveUp: boolean;
}

/** 클라이언트가 받는 최종 결과 하나 */
export type Outcome = 'ok' | 'client-timeout' | 'gateway-504' | 'db-error';

export interface SimResult {
  /** 사용자가 보낸 요청 수(재시도 제외) */
  requests: number;
  /** 클라이언트가 보낸 전체 시도 수(재시도 포함) */
  attempts: number;
  ok: number;
  clientTimeouts: number;
  gateway504: number;
  dbErrors: number;
  /** 앞단은 응답을 포기했는데, 취소하지 않아 서버가 DB 작업을 실행하게 되는 시도 수 */
  abandoned: number;
  /** 대기열(커넥션을 기다리는 쿼리)의 최대 길이 */
  maxQueue: number;
  /** 1초마다 본 대기열 길이. 막대 그래프에 써요 */
  queueEverySecond: number[];
}

interface Attempt {
  arriveAt: number;
  /** 쿼리가 실제로 필요한 시간(ms) */
  service: number;
  giveUpAt: number;
  giveUpKind: 'client-timeout' | 'gateway-504';
  retriesLeft: number;
  resolved: boolean;
  running: boolean;
  endAt: number;
  dbError: boolean;
}

/** 시드가 같으면 항상 같은 수열을 내는 난수 생성기(mulberry32) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const put = (map: Map<number, Attempt[]>, t: number, a: Attempt) => {
  const list = map.get(t);
  if (list) list.push(a);
  else map.set(t, [a]);
};

/**
 * 설정을 시간 순서대로 흘려보내요.
 * 앞단 시간 제한이 프록시 쪽이 더 짧으면 504 가, 아니면 클라이언트 타임아웃이 먼저 나요.
 */
export function simulate(s: PoolScenario, seed = 1): SimResult {
  const rand = mulberry32(seed);
  const arrivals = new Map<number, Attempt[]>();
  const giveUps = new Map<number, Attempt[]>();
  const c = { attempts: 0, ok: 0, clientTimeouts: 0, gateway504: 0, dbErrors: 0, abandoned: 0, unresolved: 0 };

  const spawn = (arriveAt: number, retriesLeft: number): Attempt => {
    const slow = rand() < s.slowRatio;
    const proxyFirst = s.proxyTimeoutMs < s.clientTimeoutMs;
    const a: Attempt = {
      arriveAt,
      service: slow ? s.slowQueryMs : s.avgQueryMs,
      giveUpAt: arriveAt + (proxyFirst ? s.proxyTimeoutMs : s.clientTimeoutMs),
      giveUpKind: proxyFirst ? 'gateway-504' : 'client-timeout',
      retriesLeft,
      resolved: false,
      running: false,
      endAt: 0,
      dbError: false,
    };
    c.attempts++;
    c.unresolved++;
    put(giveUps, a.giveUpAt, a);
    return a;
  };

  const resolve = (a: Attempt, outcome: Outcome, t: number) => {
    a.resolved = true;
    c.unresolved--;
    if (outcome === 'ok') c.ok++;
    else if (outcome === 'client-timeout') c.clientTimeouts++;
    else if (outcome === 'gateway-504') c.gateway504++;
    else c.dbErrors++;
    if (outcome !== 'ok' && a.retriesLeft > 0) {
      const retryAt = t + RETRY_DELAY_MS;
      put(arrivals, retryAt, spawn(retryAt, a.retriesLeft - 1));
    }
  };

  const requests = Math.round((s.rps * ARRIVAL_MS) / 1000);
  let lastArrival = 0;
  for (let i = 0; i < requests; i++) {
    const t = Math.round((i * 1000) / s.rps / TICK_MS) * TICK_MS;
    put(arrivals, t, spawn(t, s.retries));
    lastArrival = Math.max(lastArrival, t);
  }

  let queue: Attempt[] = [];
  let running: Attempt[] = [];
  let free = s.poolSize;
  let maxQueue = 0;
  const queueEverySecond: number[] = [];

  for (let t = 0; t <= END_MS; t += TICK_MS) {
    // 1. 도착한 시도는 커넥션을 기다리는 줄에 서요
    for (const a of arrivals.get(t) ?? []) queue.push(a);

    // 2. 쿼리가 끝난 커넥션을 돌려받아요. 앞단이 이미 포기한 시도라면 응답은 버려요
    running = running.filter((a) => {
      if (a.endAt > t) return true;
      a.running = false;
      free++;
      if (!a.resolved) resolve(a, a.dbError ? 'db-error' : 'ok', t);
      return false;
    });

    // 3. 앞단이 기다리기를 멈추는 시점. 취소를 끈 경우 줄에서 기다리던 시도도 나중에 그대로 실행되므로 여기서 세요
    for (const a of giveUps.get(t) ?? []) {
      if (a.resolved) continue;
      resolve(a, a.giveUpKind, t);
      if (s.cancelOnGiveUp) {
        if (a.running) {
          running = running.filter((x) => x !== a);
          a.running = false;
          free++;
        } else {
          queue = queue.filter((x) => x !== a);
        }
      } else {
        c.abandoned++;
      }
    }

    // 4. 빈 커넥션이 생기면 줄 맨 앞부터 배정해요. 포기된 시도도 취소를 끈 경우에는 그대로 실행돼요
    while (free > 0 && queue.length > 0) {
      const a = queue.shift() as Attempt;
      free--;
      a.dbError = a.service > s.dbTimeoutMs;
      a.endAt = t + Math.min(a.service, s.dbTimeoutMs);
      a.running = true;
      running.push(a);
    }

    maxQueue = Math.max(maxQueue, queue.length);
    if (t % 1000 === 0) queueEverySecond.push(queue.length);
    if (t >= lastArrival && c.unresolved === 0 && queue.length === 0 && running.length === 0) break;
  }

  return {
    requests,
    attempts: c.attempts,
    ok: c.ok,
    clientTimeouts: c.clientTimeouts,
    gateway504: c.gateway504,
    dbErrors: c.dbErrors,
    abandoned: c.abandoned,
    maxQueue,
    queueEverySecond,
  };
}

/** 시간 제한이 안쪽보다 짧은 바깥 계층을 찾아 설명을 돌려줘요. 빈 배열이면 순서가 맞아요 */
export function layerWarnings(s: PoolScenario): string[] {
  const out: string[] = [];
  if (s.clientTimeoutMs < s.proxyTimeoutMs) {
    out.push('클라이언트가 먼저 포기해요. 프록시의 504 는 클라이언트에 닿지 않고, 서버는 계속 일해요.');
  }
  if (s.proxyTimeoutMs < s.dbTimeoutMs) {
    out.push('프록시가 먼저 504 를 내요. DB 는 statement_timeout 까지 계속 쿼리를 실행해요.');
  }
  return out;
}
