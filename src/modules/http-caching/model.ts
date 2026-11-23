/** 응답 헤더 조합. null 은 그 헤더가 없다는 뜻이에요. */
export interface ResponseHeaders {
  maxAge: number | null;
  sMaxAge: number | null;
  staleWhileRevalidate: number | null;
  noCache: boolean;
  noStore: boolean;
  private: boolean;
  public: boolean;
  mustRevalidate: boolean;
  etag: boolean;
  lastModified: boolean;
  varyLanguage: boolean;
}

export interface Scenario {
  headers: ResponseHeaders;
  /** 저장본을 받은 뒤 지난 초 */
  ageSec: number;
  /** 요청에 Authorization 헤더가 있어요 */
  authorized: boolean;
  /** 이번 요청의 Accept-Language 가 저장본을 받은 요청과 달라요 */
  languageChanged: boolean;
  /** 원 서버의 본문이 저장본을 받은 뒤 바뀌었어요 */
  originChanged: boolean;
}

export type CacheKind = 'browser' | 'shared';

/** fresh: 신선 사용, stale: 옛 값 즉시 응답, not-modified: 304 재검증, changed: 200 재검증, origin: 원 서버 요청 */
export type Action = 'fresh' | 'stale' | 'not-modified' | 'changed' | 'origin';

export interface Verdict {
  kind: CacheKind;
  action: Action;
  /** 신선한 기간(초). 0 이면 저장본을 바로 확인해야 해요 */
  lifetimeSec: number;
  /** 신선 기간이 어디서 왔는지 */
  source: 'max-age' | 's-maxage' | 'heuristic' | 'none';
  reason: string;
}

/** 휴리스틱 계산에 쓰는 예시 값. Last-Modified 가 30일 전이라고 가정해요 */
export const LAST_MODIFIED_AGE_SEC = 30 * 24 * 60 * 60;
/** RFC 9111 §4.2.2 가 전형적인 설정으로 든 비율 */
export const HEURISTIC_FRACTION = 0.1;

export const EMPTY_HEADERS: ResponseHeaders = {
  maxAge: null,
  sMaxAge: null,
  staleWhileRevalidate: null,
  noCache: false,
  noStore: false,
  private: false,
  public: false,
  mustRevalidate: false,
  etag: false,
  lastModified: false,
  varyLanguage: false,
};

export function judge(kind: CacheKind, s: Scenario): Verdict {
  const h = s.headers;
  const shared = kind === 'shared';
  const validatable = h.etag || h.lastModified;

  const origin = (reason: string, lifetimeSec = 0, source: Verdict['source'] = 'none'): Verdict => ({
    kind,
    action: 'origin',
    lifetimeSec,
    source,
    reason,
  });

  if (h.noStore) {
    return origin('no-store 라서 어떤 캐시도 이 응답을 저장하지 않아요. 저장본이 없으니 매번 원 서버로 가요.');
  }
  if (shared && h.private) {
    return origin('private 라서 공유 캐시는 저장하지 않아요. 이 응답은 개인 캐시에만 남아요.');
  }
  if (shared && s.authorized && !(h.public || h.mustRevalidate || h.sMaxAge !== null)) {
    return origin('Authorization 요청은 public · must-revalidate · s-maxage 가 없으면 공유 캐시가 답하지 않아요.');
  }
  if (h.varyLanguage && s.languageChanged) {
    return origin(
      'Vary: Accept-Language 라서 언어가 다른 요청은 다른 표현으로 봐요. 맞는 저장본이 없어 원 서버로 가요.',
    );
  }

  const explicit = shared ? (h.sMaxAge ?? h.maxAge) : h.maxAge;
  let lifetimeSec = 0;
  let source: Verdict['source'] = 'none';
  if (explicit !== null) {
    lifetimeSec = explicit;
    source = shared && h.sMaxAge !== null ? 's-maxage' : 'max-age';
  } else if (h.lastModified) {
    lifetimeSec = HEURISTIC_FRACTION * LAST_MODIFIED_AGE_SEC;
    source = 'heuristic';
  }

  const revalidate = (why: string): Verdict => {
    if (!validatable) {
      return origin(
        `${why} ETag 와 Last-Modified 가 없어서 검증할 수 없어요. 전체 응답을 받아요.`,
        lifetimeSec,
        source,
      );
    }
    return s.originChanged
      ? {
          kind,
          action: 'changed',
          lifetimeSec,
          source,
          reason: `${why} 조건부 요청을 보냈고, 본문이 바뀌어 200 으로 새 본문을 받아 저장본을 갈아요.`,
        }
      : {
          kind,
          action: 'not-modified',
          lifetimeSec,
          source,
          reason: `${why} 조건부 요청을 보냈고, 본문이 그대로라 304 를 받아 저장본을 써요.`,
        };
  };

  if (h.noCache) {
    return revalidate('no-cache 라서 저장본을 쓰기 전에 원 서버에 확인해야 해요.');
  }

  if (s.ageSec < lifetimeSec) {
    const basis =
      source === 'heuristic'
        ? '휴리스틱으로 추정한 신선 기간 안이에요.'
        : source === 's-maxage'
          ? 's-maxage 로 정한 신선 기간 안이에요.'
          : 'max-age 로 정한 신선 기간 안이에요.';
    return { kind, action: 'fresh', lifetimeSec, source, reason: `${basis} 원 서버에 묻지 않고 저장본을 써요.` };
  }

  const staleFor = s.ageSec - lifetimeSec;
  const swrBlocked = h.mustRevalidate || (shared && h.sMaxAge !== null);
  if (h.staleWhileRevalidate !== null && !swrBlocked && staleFor < h.staleWhileRevalidate) {
    return {
      kind,
      action: 'stale',
      lifetimeSec,
      source,
      reason: `만료 뒤 stale-while-revalidate 창 안이라 옛 값을 바로 주고, 뒤에서 재검증해요.`,
    };
  }

  if (h.staleWhileRevalidate !== null && swrBlocked) {
    return revalidate(
      shared && h.sMaxAge !== null
        ? '공유 캐시는 s-maxage 가 있으면 만료된 값을 검증 없이 주지 않아요.'
        : 'must-revalidate 가 있어서 옛 값을 주지 않아요.',
    );
  }
  return revalidate('저장본이 만료됐어요.');
}

export function judgeBoth(s: Scenario): Record<CacheKind, Verdict> {
  return { browser: judge('browser', s), shared: judge('shared', s) };
}

export interface Preset {
  id: string;
  label: string;
  summary: string;
  headers: ResponseHeaders;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'user-private',
    label: '내 주문 목록',
    summary: '사용자별 응답이에요. private 로 개인 캐시에만 남겨요.',
    headers: { ...EMPTY_HEADERS, maxAge: 60, private: true },
  },
  {
    id: 'public-etag',
    label: '공개 상품 목록',
    summary: '누구나 같은 응답을 받아요. public 과 max-age 에 ETag 로 재검증을 붙여요.',
    headers: { ...EMPTY_HEADERS, maxAge: 60, public: true, etag: true, lastModified: true },
  },
  {
    id: 'cdn-s-maxage',
    label: 'CDN 에만 길게',
    summary: '개인 캐시는 매번 확인하고, 공유 캐시만 5분 동안 저장본을 써요.',
    headers: { ...EMPTY_HEADERS, maxAge: 0, sMaxAge: 300, public: true, etag: true },
  },
  {
    id: 'swr',
    label: '옛 값 먼저',
    summary: '만료 뒤 5분 동안은 옛 값을 바로 주고, 뒤에서 새 값을 받아요.',
    headers: { ...EMPTY_HEADERS, maxAge: 60, staleWhileRevalidate: 300, public: true, etag: true },
  },
  {
    id: 'no-cache',
    label: '매번 확인',
    summary: '저장은 하되 쓰기 전에 항상 원 서버에 확인해요.',
    headers: { ...EMPTY_HEADERS, noCache: true, etag: true },
  },
  {
    id: 'no-store',
    label: '결제 상세',
    summary: '어떤 캐시에도 남기지 않아요.',
    headers: { ...EMPTY_HEADERS, noStore: true },
  },
  {
    id: 'heuristic',
    label: 'Cache-Control 없음',
    summary: 'Last-Modified 만 있어요. 브라우저가 추정한 기간으로 저장본을 써요.',
    headers: { ...EMPTY_HEADERS, lastModified: true },
  },
];

export const formatSec = (sec: number): string => {
  const s = Math.round(sec);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.round(s / 60)}분`;
  if (s < 86400) return `${Math.round(s / 3600)}시간`;
  return `${Math.round(s / 86400)}일`;
};
