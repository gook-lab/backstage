// 레이트 리밋 알고리즘 비교 모델. 모든 함수는 순수해요. 같은 입력이면 항상 같은 결과가 나와요.

export const WINDOW_MS = 1000;
/** 시뮬레이터 시간축 길이. 창 3개 분량이에요 */
export const RUN_MS = 3000;

export type Algorithm = 'fixed' | 'log' | 'counter' | 'token' | 'leaky';
export type Pattern = 'steady' | 'edge' | 'burst' | 'random';
/** single: 서버 1대. two-local: 서버 2대가 각자 카운터를 가져요. two-shared: 서버 2대가 한 카운터를 함께 써요 */
export type Topology = 'single' | 'two-local' | 'two-shared';

export interface LimiterConfig {
  algorithm: Algorithm;
  /** 창 하나에 허용하는 수. 토큰 버킷에서는 버킷 용량, 누수 버킷에서는 대기 칸 수 */
  limit: number;
  windowMs: number;
  /** 토큰 버킷에서만 쓰여요. 초당 채워지는 토큰 수 */
  refillPerSec: number;
}

export interface Decision {
  /** 요청이 도착한 시각(ms) */
  atMs: number;
  allowed: boolean;
  /** 실제 처리가 시작되는 시각(ms). 누수 버킷은 대기 뒤에 처리되므로 도착과 달라요 */
  servedAtMs: number;
}

const decide = (atMs: number, allowed: boolean, servedAtMs = atMs): Decision => ({ atMs, allowed, servedAtMs });

/**
 * 고정 창: 창 번호(t / 창 길이)마다 카운터를 따로 세요.
 * 경계 앞뒤 요청이 서로 다른 창에 들어가서, 짧은 구간에 한도의 두 배가 통과할 수 있어요.
 */
function fixedWindow(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  const counts = new Map<number, number>();
  return times.map((t) => {
    const w = Math.floor(t / windowMs);
    const n = counts.get(w) ?? 0;
    const allowed = n < limit;
    if (allowed) counts.set(w, n + 1);
    return decide(t, allowed);
  });
}

/** 슬라이딩 로그: 허용된 요청 시각을 모두 들고 있다가, 최근 창 안의 개수로 판단해요 */
function slidingLog(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  const kept: number[] = [];
  return times.map((t) => {
    while (kept.length > 0 && t - kept[0] >= windowMs) kept.shift();
    const allowed = kept.length < limit;
    if (allowed) kept.push(t);
    return decide(t, allowed);
  });
}

/**
 * 이전 창 개수에 겹치는 비율을 곱해 더하는 추정식이에요.
 * elapsedRatio 는 현재 창이 얼마나 지났는지(0~1)예요.
 */
export function estimateSlidingCounter(prev: number, cur: number, elapsedRatio: number): number {
  return prev * (1 - elapsedRatio) + cur;
}

/** 슬라이딩 카운터: 창 번호별 개수만 저장하고, 이전 창과 섞어 추정해요 */
function slidingCounter(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  const counts = new Map<number, number>();
  return times.map((t) => {
    const w = Math.floor(t / windowMs);
    const cur = counts.get(w) ?? 0;
    const prev = counts.get(w - 1) ?? 0;
    const estimate = estimateSlidingCounter(prev, cur, (t - w * windowMs) / windowMs);
    const allowed = estimate < limit;
    if (allowed) counts.set(w, cur + 1);
    return decide(t, allowed);
  });
}

/**
 * 토큰 버킷: 버킷 용량 limit 까지 초당 refillPerSec 개씩 토큰이 차요. 요청마다 하나씩 써요.
 * 토큰은 밀리 단위 정수로 세서 부동소수점 오차가 쌓이지 않게 해요.
 */
function tokenBucket(times: number[], { limit, refillPerSec }: LimiterConfig): Decision[] {
  const cap = limit * 1000;
  let milli = cap;
  let last = 0;
  return times.map((t) => {
    milli = Math.min(cap, milli + (t - last) * refillPerSec);
    last = t;
    const allowed = milli >= 1000;
    if (allowed) milli -= 1000;
    return decide(t, allowed);
  });
}

/**
 * 누수 버킷(대기열형): 허용된 요청을 창 길이 / limit 간격으로 하나씩 처리해요.
 * 대기 칸(limit)이 차면 새 요청은 429 로 거절해요. 통과한 요청도 처리 시각은 뒤로 밀릴 수 있어요.
 */
function leakyBucket(times: number[], { limit, windowMs }: LimiterConfig): Decision[] {
  const gap = Math.ceil(windowMs / limit);
  let lastServed = -Infinity;
  const pending: number[] = [];
  return times.map((t) => {
    while (pending.length > 0 && pending[0] <= t) pending.shift();
    if (pending.length >= limit) return decide(t, false);
    const served = Math.max(t, lastServed + gap);
    lastServed = served;
    pending.push(served);
    return decide(t, true, served);
  });
}

/** 한 서버의 카운터 하나에 요청 시각 목록을 통과시켜요. times 는 오름차순이어야 해요 */
export function runLimiter(times: number[], cfg: LimiterConfig): Decision[] {
  switch (cfg.algorithm) {
    case 'fixed':
      return fixedWindow(times, cfg);
    case 'log':
      return slidingLog(times, cfg);
    case 'counter':
      return slidingCounter(times, cfg);
    case 'token':
      return tokenBucket(times, cfg);
    case 'leaky':
      return leakyBucket(times, cfg);
  }
}

/**
 * 서버 구성에 따라 요청을 나눠 처리해요. 요청은 번갈아 서버로 가요(라운드 로빈).
 * 공유 카운터는 한 카운터가 모든 요청을 세는 것과 같아요.
 */
export function runTopology(times: number[], cfg: LimiterConfig, topology: Topology): Decision[] {
  if (topology !== 'two-local') return runLimiter(times, cfg);
  const perServer: number[][] = [[], []];
  times.forEach((t, i) => perServer[i % 2].push(t));
  const results = perServer.map((ts) => runLimiter(ts, cfg));
  return times.map((_, i) => results[i % 2][Math.floor(i / 2)]);
}

/** 어떤 창(길이 windowMs) 안에서 처리되는 요청 수의 최댓값. 처리 시각 기준이에요 */
export function maxServedInWindow(decisions: Decision[], windowMs: number): number {
  const served = decisions
    .filter((d) => d.allowed)
    .map((d) => d.servedAtMs)
    .sort((a, b) => a - b);
  let best = 0;
  let j = 0;
  for (let i = 0; i < served.length; i++) {
    while (served[i] - served[j] >= windowMs) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
}

/** 알고리즘이 약속하는 창 안 최대 통과 수. 토큰 버킷은 버킷 용량과 보충분을 함께 봐요 */
export function promisedMax(cfg: LimiterConfig): number {
  if (cfg.algorithm === 'token') return cfg.limit + Math.floor((cfg.refillPerSec * cfg.windowMs) / 1000);
  return cfg.limit;
}

/** 시드가 같으면 항상 같은 수열을 내는 난수 생성기(mulberry32) */
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

/** 요청 도착 패턴. 모두 RUN_MS 안에서 오름차순 시각 목록을 만들어요 */
export function buildPattern(
  pattern: Pattern,
  { limit, windowMs, seed }: { limit: number; windowMs: number; seed: number },
): number[] {
  const perWindow = Math.round(limit * 1.5);
  if (pattern === 'steady') {
    const gap = Math.floor(windowMs / perWindow);
    return Array.from({ length: perWindow * 3 }, (_, i) => i * gap);
  }
  if (pattern === 'burst') {
    return Array.from({ length: limit * 3 }, (_, i) => 500 + i);
  }
  if (pattern === 'edge') {
    const before = Array.from({ length: limit }, (_, i) => windowMs - 10 * (limit - i));
    const after = Array.from({ length: limit }, (_, i) => windowMs + 10 * i);
    return [...before, ...after];
  }
  const rand = mulberry32(seed);
  return Array.from({ length: perWindow * 3 }, () => Math.floor(rand() * RUN_MS)).sort((a, b) => a - b);
}
