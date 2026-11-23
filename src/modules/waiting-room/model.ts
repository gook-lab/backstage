export const MAX_ATTEMPTS = 3;
const MAX_TICKS = 120;

export interface SpikeConfig {
  users: number;
  /** 한 틱(1초)에 백엔드가 처리할 수 있는 요청 수 */
  capacity: number;
  /** null 이면 보호 없음. 숫자면 대기실이 틱마다 그만큼만 들여보내요 */
  admitPerTick: number | null;
}

export interface TickStat {
  tick: number;
  /** 백엔드에 도착한 요청 수. 재시도가 여기에 더해져요 */
  load: number;
  served: number;
  failed: number;
  waiting: number;
}

export interface SpikeResult {
  ticks: TickStat[];
  succeeded: number;
  gaveUp: number;
  totalRequests: number;
  peakLoad: number;
  /** 성공한 사용자가 처음 도착한 뒤 성공까지 걸린 틱의 평균. 성공이 없으면 null */
  avgWait: number | null;
}

export function runSpike({ users, capacity, admitPerTick }: SpikeConfig): SpikeResult {
  let queue = admitPerTick === null ? 0 : users;
  let fresh = admitPerTick === null ? users : 0;
  const retries: number[] = new Array(MAX_ATTEMPTS + 1).fill(0);
  const ticks: TickStat[] = [];
  let succeeded = 0;
  let gaveUp = 0;
  let totalRequests = 0;
  let waitSum = 0;

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const arrivals: number[] = new Array(MAX_ATTEMPTS + 1).fill(0);
    if (admitPerTick === null) {
      arrivals[1] += fresh;
      fresh = 0;
    } else {
      const admitted = Math.min(admitPerTick, queue);
      queue -= admitted;
      arrivals[1] += admitted;
    }
    for (let a = 2; a <= MAX_ATTEMPTS; a++) {
      arrivals[a] += retries[a];
      retries[a] = 0;
    }
    const load = arrivals.reduce((sum, n) => sum + n, 0);
    if (load === 0 && queue === 0 && retries.every((n) => n === 0)) break;

    let budget = capacity;
    const next: number[] = new Array(MAX_ATTEMPTS + 1).fill(0);
    let served = 0;
    let failed = 0;
    for (let a = 1; a <= MAX_ATTEMPTS; a++) {
      const ok = Math.min(budget, arrivals[a]);
      budget -= ok;
      const bad = arrivals[a] - ok;
      served += ok;
      failed += bad;
      succeeded += ok;
      waitSum += ok * tick;
      if (a < MAX_ATTEMPTS) next[a + 1] += bad;
      else gaveUp += bad;
    }
    totalRequests += load;
    for (let a = 2; a <= MAX_ATTEMPTS; a++) retries[a] = next[a];

    ticks.push({ tick, load, served, failed, waiting: queue });
  }

  return {
    ticks,
    succeeded,
    gaveUp,
    totalRequests,
    peakLoad: ticks.reduce((max, t) => Math.max(max, t.load), 0),
    avgWait: succeeded === 0 ? null : waitSum / succeeded,
  };
}

export type Algorithm = 'fixed' | 'sliding' | 'token';
export type Pattern = 'steady' | 'edge' | 'burst';

export interface LimiterConfig {
  algorithm: Algorithm;
  /** 창 하나에 허용하는 수. 토큰 버킷에서는 버킷 용량(burst) */
  limit: number;
  windowMs: number;
  /** 토큰 버킷에서만 쓰여요. 초당 채워지는 토큰 수 */
  refillPerSec: number;
}

export interface Decision {
  atMs: number;
  allowed: boolean;
}

/** 요청 시각(ms) 목록. 같은 입력이면 항상 같은 목록이 나와요 */
export function buildPattern(
  pattern: Pattern,
  { limit, windowMs }: Pick<LimiterConfig, 'limit' | 'windowMs'>,
): number[] {
  if (pattern === 'steady') {
    const gap = Math.ceil(windowMs / limit);
    return Array.from({ length: limit * 3 }, (_, i) => i * gap);
  }
  if (pattern === 'burst') {
    return Array.from({ length: limit * 3 }, (_, i) => i);
  }
  const before = Array.from({ length: limit }, (_, i) => windowMs - 10 * (limit - i));
  const after = Array.from({ length: limit }, (_, i) => windowMs + 10 * i);
  return [...before, ...after];
}

export function runLimiter(times: number[], cfg: LimiterConfig): Decision[] {
  if (cfg.algorithm === 'fixed') return fixedWindow(times, cfg);
  if (cfg.algorithm === 'sliding') return slidingLog(times, cfg);
  return tokenBucket(times, cfg);
}

function fixedWindow(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  let currentWindow = -1;
  let count = 0;
  return times.map((atMs) => {
    const window = Math.floor(atMs / windowMs);
    if (window !== currentWindow) {
      currentWindow = window;
      count = 0;
    }
    const allowed = count < limit;
    if (allowed) count += 1;
    return { atMs, allowed };
  });
}

function slidingLog(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  const accepted: number[] = [];
  return times.map((atMs) => {
    const inWindow = accepted.filter((t) => t > atMs - windowMs).length;
    const allowed = inWindow < limit;
    if (allowed) accepted.push(atMs);
    return { atMs, allowed };
  });
}

function tokenBucket(times: number[], { limit, refillPerSec }: LimiterConfig): Decision[] {
  let tokens = limit;
  let last = 0;
  return times.map((atMs) => {
    tokens = Math.min(limit, tokens + ((atMs - last) * refillPerSec) / 1000);
    last = atMs;
    const allowed = tokens >= 1;
    if (allowed) tokens -= 1;
    return { atMs, allowed };
  });
}

/** 허용된 요청 중 하나를 기준으로, 길이 windowMs 짜리 구간에 들어간 허용 수의 최댓값 */
export function maxAllowedInWindow(decisions: Decision[], windowMs: number): number {
  const allowed = decisions.filter((d) => d.allowed).map((d) => d.atMs);
  return allowed.reduce((max, end) => {
    const inside = allowed.filter((t) => t > end - windowMs && t <= end).length;
    return Math.max(max, inside);
  }, 0);
}

/** 이 알고리즘이 어떤 길이의 구간에서도 넘기지 않겠다고 약속하는 최대 허용 수 */
export function promisedMax({ algorithm, limit, windowMs, refillPerSec }: LimiterConfig): number {
  if (algorithm === 'token') return limit + Math.floor((refillPerSec * windowMs) / 1000);
  return limit;
}
