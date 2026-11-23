export type Strategy = 'every' | 'debounce' | 'throttle';
export type StaleGuard = 'none' | 'seq' | 'abort';

export const STRATEGIES: readonly Strategy[] = ['every', 'debounce', 'throttle'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  every: '키 입력마다 보내기',
  debounce: '입력이 멈추면 보내기 (디바운스)',
  throttle: '일정 간격마다 보내기 (스로틀)',
};

export const GUARDS: readonly StaleGuard[] = ['none', 'seq', 'abort'];
export const GUARD_LABEL: Record<StaleGuard, string> = {
  none: '끄기: 도착한 순서대로 화면에 반영',
  seq: '순번 확인: 더 오래된 응답은 버리기',
  abort: '취소: 새 요청을 보내면 이전 요청을 끊기',
};

export const WINDOW_MIN = 100;
export const WINDOW_MAX = 600;
export const DEFAULT_QUERY = '사과주스';

/** 검색 대상 예시 데이터. 실제 상품명이 아니라 결과 수를 보여 주기 위한 예시예요. */
export const CATALOG: readonly string[] = [
  '사과',
  '사과주스',
  '사과잼',
  '사과 식초',
  '바나나',
  '바나나우유',
  '포도',
  '포도주스',
  '오렌지주스',
  '수박',
  '복숭아',
  '복숭아 통조림',
];

export interface Params {
  /** 사용자가 끝까지 입력한 검색어 */
  readonly query: string;
  readonly strategy: Strategy;
  /** 디바운스 대기 · 스로틀 간격 (ms) */
  readonly windowMs: number;
  readonly guard: StaleGuard;
  readonly seed: number;
}

export type RequestStatus = 'shown' | 'stale-shown' | 'ignored' | 'cancelled';

export interface Request {
  /** 보낸 순서. 1 부터 시작해요 */
  readonly id: number;
  readonly query: string;
  readonly sentAt: number;
  /** 서버 응답이 클라이언트에 도착하는 시각 (ms). 취소된 요청도 원래 도착 시각을 가져요 */
  readonly arriveAt: number;
  readonly status: RequestStatus;
}

export interface Result {
  readonly requests: readonly Request[];
  /** 글자별 입력 시각 */
  readonly keys: readonly { readonly at: number; readonly query: string }[];
  readonly typedCount: number;
  readonly sent: number;
  readonly cancelled: number;
  /** 화면에 낡은 응답이 덮어쓴 횟수 */
  readonly staleShown: number;
  readonly finalQuery: string;
  /** 화면에 마지막으로 남은 응답의 검색어. 응답이 하나도 없으면 null */
  readonly shownQuery: string | null;
  readonly shownHits: number | null;
  readonly correct: boolean;
  readonly endAt: number;
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

/** 입력 한 글자씩 만들어지는 검색어 목록. 글자 단위(코드 포인트)로 자른다 */
export function prefixesOf(query: string): string[] {
  const chars = Array.from(query);
  return chars.map((_, i) => chars.slice(0, i + 1).join(''));
}

export function countHits(query: string): number {
  return CATALOG.filter((item) => item.includes(query)).length;
}

/**
 * 입력 시각 · 응답 지연을 시드로 미리 뽑아요. 전략이나 보호 방식을 바꿔도
 * 같은 손님(같은 타이핑, 같은 네트워크)으로 비교할 수 있게 해요.
 */
function drawTimeline(query: string, seed: number) {
  const rnd = mulberry32(seed);
  const n = Array.from(query).length;
  const keyAt: number[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const pause = rnd() < 0.25 ? 450 : 0;
      t += 60 + Math.floor(rnd() * 140) + pause;
    }
    keyAt.push(t);
  }
  const latency = Array.from({ length: n }, () => {
    const slow = rnd() < 0.25;
    const base = 80 + Math.floor(rnd() * 300);
    return slow ? base + 400 + Math.floor(rnd() * 300) : base;
  });
  return { keyAt, latency };
}

interface Draft {
  id: number;
  query: string;
  sentAt: number;
  arriveAt: number;
  status: RequestStatus | null;
  inflight: boolean;
}

export function simulate(p: Params): Result {
  const windowMs = Math.max(1, Math.round(p.windowMs));
  const prefixes = prefixesOf(p.query);
  const n = prefixes.length;
  const { keyAt, latency } = drawTimeline(p.query, p.seed);

  const drafts: Draft[] = [];
  const keys: { at: number; query: string }[] = [];
  let typed = 0;
  let current = '';
  let lastKeyAt = -1;
  let pending = false;
  let lastShownId = 0;
  let shownQuery: string | null = null;
  let shownHits: number | null = null;
  let staleShown = 0;

  const send = (t: number) => {
    if (p.guard === 'abort') {
      for (const d of drafts) {
        if (d.inflight) {
          d.inflight = false;
          d.status = 'cancelled';
        }
      }
    }
    const id = drafts.length + 1;
    drafts.push({
      id,
      query: current,
      sentAt: t,
      arriveAt: t + latency[id - 1],
      status: null,
      inflight: true,
    });
    pending = false;
  };

  let t = 0;
  const LIMIT = 20000;
  for (; t < LIMIT; t++) {
    // 1. 응답 도착
    for (const d of drafts) {
      if (!d.inflight || d.arriveAt !== t) continue;
      d.inflight = false;
      if (p.guard === 'seq' && d.id < lastShownId) {
        d.status = 'ignored';
        continue;
      }
      if (d.id < lastShownId) {
        d.status = 'stale-shown';
        staleShown++;
      } else {
        d.status = 'shown';
      }
      lastShownId = d.id;
      shownQuery = d.query;
      shownHits = countHits(d.query);
    }

    // 2. 키 입력
    if (typed < n && keyAt[typed] === t) {
      current = prefixes[typed];
      keys.push({ at: t, query: current });
      typed++;
      lastKeyAt = t;
      pending = true;
      if (p.strategy === 'every') send(t);
    }

    // 3. 전략에 따른 전송
    if (p.strategy === 'debounce' && pending && t - lastKeyAt === windowMs) {
      send(t);
    }
    if (p.strategy === 'throttle' && pending && t % windowMs === 0) {
      send(t);
    }

    if (typed === n && !pending && drafts.every((d) => !d.inflight)) break;
  }

  const requests: Request[] = drafts.map((d) => ({
    id: d.id,
    query: d.query,
    sentAt: d.sentAt,
    arriveAt: d.arriveAt,
    status: d.status ?? 'cancelled',
  }));
  const finalQuery = p.query;
  return {
    requests,
    keys,
    typedCount: n,
    sent: requests.length,
    cancelled: requests.filter((r) => r.status === 'cancelled').length,
    staleShown,
    finalQuery,
    shownQuery,
    shownHits,
    correct: n === 0 || shownQuery === finalQuery,
    endAt: t,
  };
}
