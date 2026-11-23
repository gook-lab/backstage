export type Strategy = 'short' | 'long' | 'sse' | 'ws';

export const STRATEGIES: readonly Strategy[] = ['short', 'long', 'sse', 'ws'];

export const DURATION_MS = 600_000;
export const DROP_START_MS = 240_000;
export const DROP_END_MS = 330_000;
const LONG_POLL_TIMEOUT_MS = 30_000;

export interface RealtimeConfig {
  clients: number;
  /** 전체 클라이언트에 걸쳐 분당 도착하는 이벤트 수 */
  eventsPerMin: number;
  /** 짧은 폴링의 간격 P(초). 다른 방식에는 쓰이지 않아요 */
  pollSec: number;
  dropOn: boolean;
  /** 재연결 때 Last-Event-ID 나 커서로 놓친 구간을 받아요 */
  resume: boolean;
  seed: number;
}

export interface StrategyResult {
  strategy: Strategy;
  requests: number;
  requestsPerMin: number;
  /** 전달된 이벤트의 평균 지연(ms). 전달된 이벤트가 없으면 null */
  avgDelayMs: number | null;
  /** 평상시 서버가 붙잡고 있는 연결 수 */
  openConnections: number;
  events: number;
  delivered: number;
  missed: number;
  emptyResponses: number;
  /** 요청 중 빈 응답이 차지하는 비율(0~1) */
  emptyRatio: number;
}

interface Tally {
  requests: number;
  empty: number;
  delivered: number;
  delaySum: number;
}

interface EventAt {
  at: number;
  client: number;
}

/** 같은 시드면 항상 같은 수열을 내는 작은 난수 생성기 */
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

function inDrop(at: number, cfg: RealtimeConfig): boolean {
  return cfg.dropOn && at >= DROP_START_MS && at < DROP_END_MS;
}

function makeEvents(cfg: RealtimeConfig, rng: () => number): EventAt[] {
  const count = Math.round((cfg.eventsPerMin * DURATION_MS) / 60_000);
  const events = Array.from({ length: count }, () => ({
    at: Math.floor(rng() * DURATION_MS),
    client: Math.floor(rng() * cfg.clients),
  }));
  return events.sort((a, b) => a.at - b.at);
}

export function simulate(strategy: Strategy, cfg: RealtimeConfig): StrategyResult {
  const rng = mulberry32(cfg.seed);
  const events = makeEvents(cfg, rng);
  const tally = strategy === 'short' ? pollTally(events, cfg, rng) : pushTally(strategy, events, cfg);
  const minutes = DURATION_MS / 60_000;
  return {
    strategy,
    requests: tally.requests,
    requestsPerMin: tally.requests / minutes,
    avgDelayMs: tally.delivered === 0 ? null : tally.delaySum / tally.delivered,
    openConnections: strategy === 'short' ? 0 : cfg.clients,
    events: events.length,
    delivered: tally.delivered,
    missed: events.length - tally.delivered,
    emptyResponses: tally.empty,
    emptyRatio: tally.requests === 0 ? 0 : tally.empty / tally.requests,
  };
}

function emptyTally(): Tally {
  return { requests: 0, empty: 0, delivered: 0, delaySum: 0 };
}

function pollTally(events: EventAt[], cfg: RealtimeConfig, rng: () => number): Tally {
  const period = cfg.pollSec * 1000;
  const tally = emptyTally();
  const perClient: number[][] = Array.from({ length: cfg.clients }, () => []);
  for (const e of events) perClient[e.client].push(e.at);

  for (const times of perClient) {
    let next = 0;
    for (let at = Math.floor(rng() * period); at < DURATION_MS + period; at += period) {
      if (inDrop(at, cfg)) continue;
      const counted = at < DURATION_MS;
      if (counted) tally.requests += 1;
      let got = 0;
      while (next < times.length && times[next] <= at) {
        tally.delaySum += at - times[next];
        next += 1;
        got += 1;
      }
      tally.delivered += got;
      if (counted && got === 0) tally.empty += 1;
    }
  }
  return tally;
}

function deliveryAt(at: number, cfg: RealtimeConfig): number | null {
  if (!inDrop(at, cfg)) return at;
  return cfg.resume ? DROP_END_MS : null;
}

function pushTally(strategy: Strategy, events: EventAt[], cfg: RealtimeConfig): Tally {
  const tally = emptyTally();
  const arrived: number[][] = Array.from({ length: cfg.clients }, () => []);
  for (const e of events) {
    const at = deliveryAt(e.at, cfg);
    if (at === null) continue;
    tally.delivered += 1;
    tally.delaySum += at - e.at;
    arrived[e.client].push(at);
  }

  const reconnects = cfg.dropOn ? cfg.clients : 0;
  if (strategy !== 'long') {
    tally.requests = cfg.clients + reconnects;
    return tally;
  }

  tally.requests = reconnects;
  const segments: [number, number][] = cfg.dropOn
    ? [
        [0, DROP_START_MS],
        [DROP_END_MS, DURATION_MS],
      ]
    : [[0, DURATION_MS]];
  for (const times of arrived) {
    for (const [from, to] of segments) {
      let last = from;
      for (const at of times) {
        if (at < from || at >= to) continue;
        const timeouts = Math.floor((at - last) / LONG_POLL_TIMEOUT_MS);
        tally.empty += timeouts;
        tally.requests += timeouts + 1;
        last = at;
      }
      const idle = Math.floor((to - last) / LONG_POLL_TIMEOUT_MS);
      tally.empty += idle;
      tally.requests += idle;
    }
  }
  return tally;
}

export function simulateAll(cfg: RealtimeConfig): StrategyResult[] {
  return STRATEGIES.map((strategy) => simulate(strategy, cfg));
}
