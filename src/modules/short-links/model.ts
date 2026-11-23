// 짧은 링크 시뮬레이터의 순수 모델. 네트워크 · 저장소 없이 확률과 응답 규칙만 계산해요.

export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const BASE = 62;

export type CodeMethod = 'seq' | 'rand6' | 'rand8';
export const METHODS: readonly CodeMethod[] = ['seq', 'rand6', 'rand8'];
export const METHOD_LABEL: Record<CodeMethod, string> = {
  seq: '순번 base62',
  rand6: '무작위 6자',
  rand8: '무작위 8자',
};
export const METHOD_HINT: Record<CodeMethod, string> = {
  seq: '1, 2, 3 순번을 62진수로 바꿔요. 충돌은 없지만 앞에서부터 나열하면 전부 맞혀요.',
  rand6: '무작위 6자를 뽑고, 저장할 때 중복이면 다시 뽑아요. 나열로는 찾기 어려워요.',
  rand8: '무작위 8자를 뽑아요. 코드가 길어지는 대신 같은 링크 수에서 충돌 확률이 낮아요.',
};

export type RedirectStatus = 301 | 302 | 307 | 308;
export const STATUSES: readonly RedirectStatus[] = [301, 302, 307, 308];
export const STATUS_LABEL: Record<RedirectStatus, string> = {
  301: '301 영구',
  302: '302 임시',
  307: '307 임시 · 메서드 유지',
  308: '308 영구 · 메서드 유지',
};

/** 영구(301 · 308)인지, 메서드를 바꾸지 않는지 */
export const PERMANENT: Record<RedirectStatus, boolean> = { 301: true, 302: false, 307: false, 308: true };
export const KEEPS_METHOD: Record<RedirectStatus, boolean> = { 301: false, 302: false, 307: true, 308: true };
/** RFC 9110 이 휴리스틱 캐시 가능으로 분류한 상태 코드 중 리다이렉트 쪽 */
export const HEURISTIC_CACHEABLE: Record<RedirectStatus, boolean> = { 301: true, 302: false, 307: false, 308: true };

export type CacheHeader = 'none' | 'max-age' | 'no-store';
export const CACHE_HEADERS: readonly CacheHeader[] = ['none', 'max-age', 'no-store'];
export const CACHE_LABEL: Record<CacheHeader, string> = {
  none: '헤더 없음',
  'max-age': 'max-age=3600',
  'no-store': 'no-store',
};

/** 0 이상 정수를 62진수 문자열로 바꿔요. */
export function encodeBase62(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError('0 이상의 안전한 정수만 바꿀 수 있어요');
  }
  if (n === 0) return ALPHABET[0];
  let rest = n;
  let out = '';
  while (rest > 0) {
    out = ALPHABET[rest % BASE] + out;
    rest = Math.floor(rest / BASE);
  }
  return out;
}

/** 링크 수 n 을 담을 코드 길이. 순번은 가장 큰 번호가 몇 자인지로 정해요. */
export function codeLength(method: CodeMethod, links: number): number {
  if (method === 'rand6') return 6;
  if (method === 'rand8') return 8;
  return encodeBase62(Math.max(0, links - 1)).length;
}

/** 길이 L 인 코드가 가질 수 있는 경우의 수 (62^L) */
export function codeSpace(length: number): number {
  return BASE ** length;
}

/**
 * 무작위 코드 n개를 만들 때 같은 코드가 한 쌍이라도 생길 확률.
 * 생일 문제 근사: 1 - exp(-n(n-1) / (2N)). 순번 방식은 충돌이 없어서 0 이에요.
 */
export function collisionProbability(method: CodeMethod, links: number): number {
  if (method === 'seq') return 0;
  const space = codeSpace(codeLength(method, links));
  const exponent = (links * (links - 1)) / (2 * space);
  return -Math.expm1(-exponent);
}

export interface GuessOutcome {
  /** 무작위 추측 한 번이 살아 있는 링크를 맞힐 확률 (n / N) */
  hitRate: number;
  /** 추측 g번 뒤 찾은 링크 수의 기대값 */
  expectedHits: number;
  /** 추측 g번 중 한 번이라도 맞힐 확률 */
  probAtLeastOne: number;
}

/**
 * 공격자가 코드를 추측하는 경우.
 * - 순번: 0 부터 차례로 나열하면 g번째까지 전부 살아 있는 링크라서 min(g, n) 개를 찾아요.
 * - 무작위: 살아 있는 코드가 공간에 흩어져 있어 g번 추측의 기대값은 g · n / N 이에요.
 */
export function guessOutcome(method: CodeMethod, links: number, guesses: number): GuessOutcome {
  const space = codeSpace(codeLength(method, links));
  const hitRate = links / space;
  if (method === 'seq') {
    return {
      hitRate,
      expectedHits: Math.min(guesses, links),
      probAtLeastOne: guesses >= 1 && links >= 1 ? 1 : 0,
    };
  }
  return {
    hitRate,
    expectedHits: guesses * hitRate,
    probAtLeastOne: -Math.expm1(guesses * Math.log1p(-hitRate)),
  };
}

/**
 * 재방문자가 대상 변경 전에 리다이렉트 응답을 받아 저장해 두었고, 변경 뒤 다시 찾아왔을 때
 * 옛 주소로 가는지. 저장 기간은 브라우저 구현에 따라 달라서 시뮬레이터는 "갈 수 있음"으로 봐요.
 */
export function staleAfterChange(status: RedirectStatus, cache: CacheHeader): boolean {
  if (cache === 'no-store') return false;
  if (cache === 'max-age') return true;
  return HEURISTIC_CACHEABLE[status];
}
