// 장애 격리 시뮬레이터 모델. 모든 함수는 순수해요. 같은 설정과 시드면 항상 같은 결과가 나와요.
// 시간은 TICK_MS 단위로 흘러요. 사용자 요청 하나는 상품 정보(핵심 호출)와 추천(의존 서비스 호출)을 함께 불러요.
// 모든 수치는 설명을 위한 예시예요.

/** 시뮬레이터 시간 간격(ms). 설정값이 모두 이 단위의 배수라 틱에 딱 맞아요 */
export const TICK_MS = 10;
/** 사용자 요청이 도착하는 구간(초). 장애 구간 뒤의 회복도 함께 보여 줘요 */
export const DURATION_SEC = 60;
/** 장애 구간 시작(초). 이 구간 안에서만 추천 서비스가 느려지거나 실패해요 */
export const FAULT_START_SEC = 10;
/** 장애 구간 끝(초) */
export const FAULT_END_SEC = 40;
/** 페이지가 기다려 주는 최대 시간(ms). 이 안에 추천이 오지 않으면 대체 응답이나 실패로 끝나요 */
export const PAGE_BUDGET_MS = 1500;
/** 상품 정보 호출 시간(ms). 이 호출은 의존 서비스와 무관하게 정상이라고 가정해요 */
export const CORE_MS = 60;
/** 추천 서비스가 정상일 때 응답 시간(ms) */
export const NORMAL_DEP_MS = 80;
/** 연결 칸 전체 수. 벌크헤드를 끄면 상품 정보와 추천이 이 칸을 같이 써요 */
export const TOTAL_SLOTS = 40;
/** 벌크헤드를 켜면 추천 호출에 떼어 주는 칸 수. 나머지는 상품 정보 몫이에요 */
export const BULKHEAD_SLOTS = 10;
/** 동기화 옵션에서 한 시각에 같이 도착하는 요청 수 */
export const SYNCED_BATCH = 10;
/** 첫 재시도 전 대기 시간(ms). 회차마다 두 배로 늘어나요 */
export const BACKOFF_BASE_MS = 200;

export interface DegradeScenario {
  /** 초당 사용자 요청 수 */
  rps: number;
  /** true 면 요청이 SYNCED_BATCH 건씩 한 시각에 묶여 도착해요. 재시도도 같은 묶음끼리 같은 시각에 맞춰져요 */
  synced: boolean;
  /** 장애 구간 추천 응답 시간(ms) */
  faultLatencyMs: number;
  /** 장애 구간 추천 실패율(0~1). 응답이 시간 안에 와도 이 비율은 실패로 돌아와요 */
  faultFailRate: number;
  /** 추천 호출 하나의 시간 제한(ms). 페이지 예산보다 길어도 페이지 예산에서 끊겨요 */
  callTimeoutMs: number;
  /** 서킷 브레이커 사용 여부 */
  breaker: boolean;
  /** 서킷이 열리는 연속 실패 수. 실제 구현은 시간 창이나 비율을 쓰기도 해요 */
  breakerThreshold: number;
  /** 열림 상태를 유지하는 시간(ms). 이 시간이 지나면 반열림으로 시험 호출 하나를 보내요 */
  breakerOpenMs: number;
  /** 실패한 추천 호출을 다시 보내는 횟수 */
  retries: number;
  /** 재시도 간격을 0 ~ 백오프 사이에서 무작위로 고르는지 여부 */
  jitter: boolean;
  /** 벌크헤드로 추천 호출의 칸을 따로 둘지 여부 */
  bulkhead: boolean;
  /** 추천이 실패하면 빈 추천 영역으로 대체 응답을 줄지 여부 */
  fallback: boolean;
}

export type PageOutcome = 'ok' | 'degraded' | 'failed';

export interface DegradeResult {
  requests: number;
  ok: number;
  degraded: number;
  failed: number;
  /** 상품 정보 호출이 칸을 받지 못해 실패한 요청 수 */
  coreFailed: number;
  /** 추천 서비스로 실제로 보낸 호출 수(재시도 포함) */
  depCalls: number;
  /** 서킷이 열려 있거나 반열림 시험 중이라 보내지 않은 호출 수 */
  breakerBlocked: number;
  /** 칸이 없어서 보내지 못한 추천 호출 수 */
  slotBlocked: number;
  /** 서킷이 열린 횟수 */
  breakerTrips: number;
  /** 한 틱(TICK_MS) 안에 시작된 추천 호출 수의 최대값. 재시도가 몰린 정도를 봐요 */
  peakCallsPerTick: number;
  /** 1초마다 추천 서비스로 보낸 호출 수와 실패한 요청 수 */
  perSecond: { depCalls: number; failed: number }[];
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

/** 장애 구간 안인지 시각(ms)으로 확인해요 */
export const isFaultAt = (t: number): boolean => t >= FAULT_START_SEC * 1000 && t < FAULT_END_SEC * 1000;

type BreakerState = 'closed' | 'open' | 'half';

interface Req {
  start: number;
  deadline: number;
  core: 'pending' | 'ok' | 'failed';
  dep: 'pending' | 'ok' | 'failed';
  settled: boolean;
}

interface Call {
  kind: 'core' | 'dep';
  req: Req;
  endAt: number;
  ok: boolean;
  trial: boolean;
  attempt: number;
  retriesLeft: number;
}

interface Retry {
  req: Req;
  attempt: number;
  retriesLeft: number;
}

const push = <T>(map: Map<number, T[]>, t: number, v: T) => {
  const list = map.get(t);
  if (list) list.push(v);
  else map.set(t, [v]);
};

/**
 * 요청을 시간 순서대로 흘려보내요.
 * 칸은 호출이 끝나거나 시간 제한에 걸릴 때 돌아와요. 호출자가 기다리기를 멈추면 칸도 같이 비워요.
 */
export function simulateDegrade(s: DegradeScenario, seed = 1): DegradeResult {
  const rand = mulberry32(seed);
  const arrivals = new Map<number, Req[]>();
  const retries = new Map<number, Retry[]>();
  let inflight: Call[] = [];
  let startsThisTick = 0;

  const r: DegradeResult = {
    requests: 0,
    ok: 0,
    degraded: 0,
    failed: 0,
    coreFailed: 0,
    depCalls: 0,
    breakerBlocked: 0,
    slotBlocked: 0,
    breakerTrips: 0,
    peakCallsPerTick: 0,
    perSecond: Array.from({ length: DURATION_SEC }, () => ({ depCalls: 0, failed: 0 })),
  };

  const busy = { core: 0, dep: 0 };
  const canAcquire = (kind: 'core' | 'dep') => {
    if (s.bulkhead) return kind === 'dep' ? busy.dep < BULKHEAD_SLOTS : busy.core < TOTAL_SLOTS - BULKHEAD_SLOTS;
    return busy.core + busy.dep < TOTAL_SLOTS;
  };

  // 클로저 안에서 바뀌므로 타입을 넓게 고정해요. 그러지 않으면 루프에서 좁혀져 비교가 막혀요
  let state = 'closed' as BreakerState;
  let consecutive = 0;
  let openUntil = 0;
  let trialRunning = false;

  const trip = (t: number) => {
    state = 'open';
    openUntil = t + s.breakerOpenMs;
    consecutive = 0;
    r.breakerTrips++;
  };

  const settle = (req: Req) => {
    if (req.settled || req.core === 'pending' || req.dep === 'pending') return;
    req.settled = true;
    const sec = Math.min(DURATION_SEC - 1, Math.floor(req.start / 1000));
    let outcome: PageOutcome;
    if (req.core === 'failed') {
      outcome = 'failed';
      r.coreFailed++;
    } else if (req.dep === 'ok') {
      outcome = 'ok';
    } else {
      outcome = s.fallback ? 'degraded' : 'failed';
    }
    r[outcome]++;
    if (outcome === 'failed') r.perSecond[sec].failed++;
  };

  const finishDep = (req: Req, ok: boolean) => {
    req.dep = ok ? 'ok' : 'failed';
    settle(req);
  };

  const startCore = (req: Req, t: number) => {
    if (!canAcquire('core')) {
      req.core = 'failed';
      settle(req);
      return;
    }
    busy.core++;
    inflight.push({ kind: 'core', req, endAt: t + CORE_MS, ok: true, trial: false, attempt: 0, retriesLeft: 0 });
  };

  /** 실패한 시도를 재시도 예약하거나, 재시도 횟수가 다하면 실패로 확정해요 */
  const retryOrFail = (req: Req, t: number, retriesLeft: number, attempt: number) => {
    if (retriesLeft > 0) {
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;
      const wait = s.jitter ? rand() * backoff : backoff;
      // 재시도는 항상 다음 틱 이후로 잡아요. 같은 틱에 잡으면 이미 처리한 시각이라 놓쳐요
      const at = Math.max(t + TICK_MS, Math.ceil((t + wait) / TICK_MS) * TICK_MS);
      if (at < req.deadline) {
        push(retries, at, { req, attempt: attempt + 1, retriesLeft: retriesLeft - 1 });
        return;
      }
    }
    finishDep(req, false);
  };

  const startDep = (req: Req, t: number, retriesLeft: number, attempt: number) => {
    // 서킷이 열려 있으면 바로 막아요. 재시도도 하지 않아요
    if (s.breaker && (state === 'open' || (state === 'half' && trialRunning))) {
      r.breakerBlocked++;
      finishDep(req, false);
      return;
    }
    // 칸이 없는 거절은 실패한 시도로 세고, 재시도 대상이에요
    if (!canAcquire('dep')) {
      r.slotBlocked++;
      retryOrFail(req, t, retriesLeft, attempt);
      return;
    }
    busy.dep++;
    const trial = s.breaker && state === 'half';
    if (trial) trialRunning = true;
    const fault = isFaultAt(t);
    const latency = fault ? s.faultLatencyMs : NORMAL_DEP_MS;
    const budget = Math.min(s.callTimeoutMs, req.deadline - t);
    const failed = fault && rand() < s.faultFailRate;
    const ok = !failed && latency <= budget;
    const sec = Math.min(DURATION_SEC - 1, Math.floor(t / 1000));
    r.depCalls++;
    r.perSecond[sec].depCalls++;
    startsThisTick++;
    inflight.push({
      kind: 'dep',
      req,
      endAt: t + Math.min(latency, budget),
      ok,
      trial,
      attempt,
      retriesLeft,
    });
  };

  const recordDep = (c: Call, t: number) => {
    if (!s.breaker) return;
    if (c.ok) {
      consecutive = 0;
      if (c.trial) {
        state = 'closed';
        trialRunning = false;
      }
      return;
    }
    if (c.trial) {
      trialRunning = false;
      trip(t);
      return;
    }
    consecutive++;
    if (state === 'closed' && consecutive >= s.breakerThreshold) trip(t);
  };

  const finishCall = (c: Call, t: number) => {
    busy[c.kind]--;
    if (c.kind === 'core') {
      c.req.core = 'ok';
      settle(c.req);
      return;
    }
    recordDep(c, t);
    if (c.ok) {
      finishDep(c.req, true);
      return;
    }
    retryOrFail(c.req, t, c.retriesLeft, c.attempt);
  };

  const total = Math.round(s.rps * DURATION_SEC);
  for (let i = 0; i < total; i++) {
    const gap = s.synced ? (SYNCED_BATCH * 1000) / s.rps : 1000 / s.rps;
    const group = s.synced ? Math.floor(i / SYNCED_BATCH) : i;
    const t = Math.round((group * gap) / TICK_MS) * TICK_MS;
    push(arrivals, t, { start: t, deadline: t + PAGE_BUDGET_MS, core: 'pending', dep: 'pending', settled: false });
  }
  r.requests = total;

  const endAt = DURATION_SEC * 1000 + PAGE_BUDGET_MS;
  for (let t = 0; t <= endAt; t += TICK_MS) {
    startsThisTick = 0;

    // 1. 끝난 호출의 칸을 돌려받고 결과를 반영해요
    const done = inflight.filter((c) => c.endAt <= t);
    inflight = inflight.filter((c) => c.endAt > t);
    for (const c of done) finishCall(c, t);

    // 2. 열림 시간이 끝나면 반열림으로 바꿔 시험 호출을 받게 해요
    if (s.breaker && state === 'open' && t >= openUntil) state = 'half';

    // 3. 예약된 재시도를 보내요
    for (const x of retries.get(t) ?? []) startDep(x.req, t, x.retriesLeft, x.attempt);
    retries.delete(t);

    // 4. 새 요청은 상품 정보와 추천을 함께 불러요
    // 두 호출은 거의 동시에 나가요. 어느 쪽이 먼저 칸을 잡을지는 무작위로 정해요
    for (const req of arrivals.get(t) ?? []) {
      if (rand() < 0.5) {
        startCore(req, t);
        startDep(req, t, s.retries, 0);
      } else {
        startDep(req, t, s.retries, 0);
        startCore(req, t);
      }
    }
    arrivals.delete(t);

    r.peakCallsPerTick = Math.max(r.peakCallsPerTick, startsThisTick);
  }

  return r;
}
