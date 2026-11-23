import { describe, expect, it } from 'vitest';
import { EMPTY_HEADERS, judge, judgeBoth, LAST_MODIFIED_AGE_SEC, PRESETS, type Scenario } from './model';

const base: Scenario = {
  headers: EMPTY_HEADERS,
  ageSec: 0,
  authorized: false,
  languageChanged: false,
  originChanged: false,
};

const at = (headers: Partial<Scenario['headers']>, ageSec: number, extra: Partial<Scenario> = {}): Scenario => ({
  ...base,
  headers: { ...EMPTY_HEADERS, ...headers },
  ageSec,
  ...extra,
});

const preset = (id: string) => PRESETS.find((p) => p.id === id)!.headers;

describe('신선도 — max-age 기간 안에서는 원 서버에 묻지 않아요', () => {
  it('max-age 60 은 60초 안에서 두 층 모두 신선 사용이에요', () => {
    const both = judgeBoth(at({ maxAge: 60, public: true }, 30));
    expect(both.browser.action).toBe('fresh');
    expect(both.shared.action).toBe('fresh');
  });

  it('신선 기간이 지나면 검증 값이 있을 때 304 로 재검증해요', () => {
    const v = judge('browser', at({ maxAge: 60, etag: true }, 60));
    expect(v.action).toBe('not-modified');
  });

  it('원 서버 본문이 바뀌었으면 같은 재검증이 200 으로 새 본문을 받아요', () => {
    const v = judge('browser', at({ maxAge: 60, etag: true }, 60, { originChanged: true }));
    expect(v.action).toBe('changed');
  });

  it('검증 값이 없으면 만료 뒤 원 서버로 가요', () => {
    expect(judge('browser', at({ maxAge: 60 }, 120)).action).toBe('origin');
  });
});

describe('공유 캐시 — s-maxage 가 max-age 보다 먼저 적용돼요', () => {
  it('max-age=0 과 s-maxage=300 이면 개인 캐시는 재검증하고 공유 캐시는 신선 사용해요', () => {
    const both = judgeBoth(at({ maxAge: 0, sMaxAge: 300, etag: true, public: true }, 10));
    expect(both.browser.action).toBe('not-modified');
    expect(both.shared.action).toBe('fresh');
    expect(both.shared.source).toBe('s-maxage');
  });

  it('개인 캐시는 s-maxage 를 신선 기간으로 쓰지 않아요', () => {
    const v = judge('browser', at({ maxAge: 0, sMaxAge: 300, etag: true, public: true }, 10));
    expect(v.lifetimeSec).toBe(0);
  });
});

describe('저장 금지 — no-store 와 private', () => {
  it('no-store 는 두 층 모두 원 서버로 보내요', () => {
    const both = judgeBoth(at({ noStore: true, maxAge: 60 }, 1));
    expect(both.browser.action).toBe('origin');
    expect(both.shared.action).toBe('origin');
  });

  it('private 는 공유 캐시에 저장하지 않지만 개인 캐시에는 신선 사용을 허용해요', () => {
    const both = judgeBoth(at({ private: true, maxAge: 60 }, 30));
    expect(both.browser.action).toBe('fresh');
    expect(both.shared.action).toBe('origin');
  });
});

describe('인증 응답 — Authorization 이 있으면 공유 캐시는 public 이 있어야 답해요', () => {
  it('Authorization 이 있고 public 이 없으면 공유 캐시는 답하지 않아요', () => {
    const v = judge('shared', at({ maxAge: 60 }, 30, { authorized: true }));
    expect(v.action).toBe('origin');
  });

  it('Authorization 이 있어도 public 이 있으면 공유 캐시가 신선 사용해요', () => {
    const v = judge('shared', at({ maxAge: 60, public: true }, 30, { authorized: true }));
    expect(v.action).toBe('fresh');
  });
});

describe('휴리스틱 캐시 — Cache-Control 이 없을 때 Last-Modified 로 추정해요', () => {
  it('Last-Modified 의 10% 안에서는 추정 신선 기간을 써요', () => {
    const v = judge('browser', at({ lastModified: true }, 24 * 60 * 60));
    expect(v.source).toBe('heuristic');
    expect(v.action).toBe('fresh');
    expect(v.lifetimeSec).toBeCloseTo(LAST_MODIFIED_AGE_SEC * 0.1);
  });

  it('추정 기간이 지나면 Last-Modified 로 재검증해요', () => {
    const v = judge('browser', at({ lastModified: true }, 4 * 24 * 60 * 60));
    expect(v.action).toBe('not-modified');
  });
});

describe('옛 값 먼저 — stale-while-revalidate 창', () => {
  it('만료 뒤 창 안에서는 옛 값을 바로 주고 뒤에서 재검증해요', () => {
    const v = judge('browser', at({ maxAge: 60, staleWhileRevalidate: 300, etag: true, public: true }, 200));
    expect(v.action).toBe('stale');
  });

  it('창이 지나면 옛 값을 주지 않고 재검증해요', () => {
    const v = judge('browser', at({ maxAge: 60, staleWhileRevalidate: 300, etag: true, public: true }, 500));
    expect(v.action).toBe('not-modified');
  });

  it('must-revalidate 가 같이 있으면 창이 있어도 옛 값을 주지 않아요', () => {
    const v = judge(
      'browser',
      at({ maxAge: 60, staleWhileRevalidate: 300, mustRevalidate: true, etag: true, public: true }, 200),
    );
    expect(v.action).toBe('not-modified');
  });

  it('공유 캐시는 s-maxage 가 있으면 창이 있어도 옛 값을 주지 않아요', () => {
    const v = judge('shared', at({ maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 300, etag: true, public: true }, 90));
    expect(v.action).toBe('not-modified');
  });
});

describe('no-cache — 저장은 하되 쓰기 전에 확인해요', () => {
  it('신선 기간이 0 이어도 항상 검증해요', () => {
    expect(judge('browser', at({ noCache: true, etag: true }, 0)).action).toBe('not-modified');
  });
});

describe('Vary — 언어가 다르면 저장본을 쓰지 않아요', () => {
  it('Vary: Accept-Language 와 언어 변경이 함께 있으면 두 층 모두 원 서버로 가요', () => {
    const both = judgeBoth(at({ maxAge: 60, public: true, varyLanguage: true }, 10, { languageChanged: true }));
    expect(both.browser.action).toBe('origin');
    expect(both.shared.action).toBe('origin');
  });

  it('언어가 같으면 Vary 가 있어도 신선 사용해요', () => {
    const v = judge('browser', at({ maxAge: 60, varyLanguage: true }, 10));
    expect(v.action).toBe('fresh');
  });
});

describe('예시 응답 — 시나리오별 기대 결과', () => {
  it('공유 캐시만 신선 사용하고 개인 캐시는 재검증해요 (s-maxage 예시, 200초 경과)', () => {
    const both = judgeBoth({ ...base, headers: preset('cdn-s-maxage'), ageSec: 200 });
    expect(both.shared.action).toBe('fresh');
    expect(both.browser.action).toBe('not-modified');
  });

  it('결제 상세(no-store)는 저장본이 없어 어떤 층도 옛 데이터를 주지 않아요', () => {
    const both = judgeBoth({ ...base, headers: preset('no-store'), ageSec: 1 });
    expect(both.browser.action).toBe('origin');
    expect(both.shared.action).toBe('origin');
  });

  it('모든 예시 프리셋은 두 층의 판정을 같은 형식으로 돌려 줘요', () => {
    for (const p of PRESETS) {
      const both = judgeBoth({ ...base, headers: p.headers, ageSec: 300 });
      expect(both.browser.reason.length).toBeGreaterThan(0);
      expect(both.shared.reason.length).toBeGreaterThan(0);
    }
  });
});
