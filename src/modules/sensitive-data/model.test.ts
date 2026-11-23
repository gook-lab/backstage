import { describe, expect, it } from 'vitest';
import { type Answers, DEFAULT_ANSWERS, exposure, PRESETS, responseFields, retentionDays, summarize } from './model';

const itemsOf = (a: Answers, id: string) => exposure(a).find((s) => s.id === id)?.items ?? [];

describe('기본 설정 — 재설정 링크를 쿼리로 보낸 상태', () => {
  it('토큰은 접근 로그 · 앱 로그 · 에러 추적 · 분석 · 브라우저 기록 다섯 곳에 남아요', () => {
    expect(summarize(DEFAULT_ANSWERS).tokenStores).toBe(5);
    for (const id of ['access', 'app', 'error', 'analytics', 'history']) {
      expect(itemsOf(DEFAULT_ANSWERS, id)).toContain('token');
    }
  });

  it('기본 Referrer-Policy 에서는 Referer 에 쿼리가 실리지 않아요', () => {
    expect(itemsOf(DEFAULT_ANSWERS, 'referer')).toEqual([]);
  });

  it('이메일과 카드 번호는 본문에 있어 접근 로그에는 남지 않아요', () => {
    expect(itemsOf(DEFAULT_ANSWERS, 'access')).toEqual(['token']);
    expect(itemsOf(DEFAULT_ANSWERS, 'app')).toEqual(['token', 'email', 'card']);
  });
});

describe('토큰 자리 옮기기', () => {
  it('토큰을 본문으로만 옮기면 접근 로그와 브라우저 기록에서는 빠지지만 나머지에는 남아요', () => {
    const a: Answers = { ...DEFAULT_ANSWERS, token: 'body' };
    expect(itemsOf(a, 'access')).toEqual([]);
    expect(itemsOf(a, 'history')).toEqual([]);
    expect(itemsOf(a, 'app')).toContain('token');
    expect(itemsOf(a, 'error')).toContain('token');
    expect(itemsOf(a, 'analytics')).toContain('token');
  });

  it('헤더에 둔 값은 접근 로그와 브라우저 기록에 남지 않아요', () => {
    const a: Answers = { ...DEFAULT_ANSWERS, token: 'header' };
    expect(itemsOf(a, 'access')).toEqual([]);
    expect(itemsOf(a, 'history')).toEqual([]);
  });
});

describe('앱 로그 설정', () => {
  it('마스킹과 허용 목록은 민감한 값을 앱 로그에 남기지 않아요', () => {
    expect(itemsOf({ ...DEFAULT_ANSWERS, appLog: 'mask' }, 'app')).toEqual([]);
    expect(itemsOf({ ...DEFAULT_ANSWERS, appLog: 'allowlist' }, 'app')).toEqual([]);
  });
});

describe('에러 추적 정리', () => {
  it('본문과 헤더를 지워도 주소의 쿼리는 에러 추적 도구에 남아요', () => {
    const a: Answers = { ...DEFAULT_ANSWERS, errorScrub: true };
    expect(itemsOf(a, 'error')).toEqual(['token']);
  });

  it('헤더에 둔 인증 값은 정리하면 에러 추적에서 빠져요', () => {
    const a: Answers = { ...DEFAULT_ANSWERS, token: 'header', errorScrub: true };
    expect(itemsOf(a, 'error')).toEqual([]);
  });
});

describe('Referrer-Policy', () => {
  it('unsafe-url 이면 쿼리의 토큰이 Referer 에 실려요', () => {
    expect(itemsOf({ ...DEFAULT_ANSWERS, referrer: 'unsafe-url' }, 'referer')).toEqual(['token']);
  });

  it('no-referrer 이면 Referer 에 아무 값도 실리지 않아요', () => {
    expect(itemsOf({ ...DEFAULT_ANSWERS, token: 'query', referrer: 'no-referrer' }, 'referer')).toEqual([]);
  });
});

describe('분석 이벤트 설계', () => {
  it('경로와 허용 속성만 보내면 분석 이벤트에 민감한 값이 없어요', () => {
    expect(itemsOf({ ...DEFAULT_ANSWERS, analytics: 'designed' }, 'analytics')).toEqual([]);
  });
});

describe('응답 필드와 보존 기간', () => {
  it('사용자 객체를 통째로 내리면 민감한 필드가 응답에 실려요', () => {
    expect(responseFields(DEFAULT_ANSWERS)).toContain('passwordHash');
  });

  it('필요한 결과만 내리면 응답 필드는 ok 하나예요', () => {
    expect(responseFields({ ...DEFAULT_ANSWERS, response: 'needed' })).toEqual(['ok']);
  });

  it('짧은 보존 기간과 긴 보존 기간의 예시 일수가 달라요', () => {
    expect(retentionDays({ ...DEFAULT_ANSWERS, retention: 'short' })).toBe(7);
    expect(retentionDays({ ...DEFAULT_ANSWERS, retention: 'long' })).toBe(365);
  });
});

describe('예시 세 가지', () => {
  const byId = (id: string) => PRESETS.find((p) => p.id === id)!;

  it('쿼리 기본 설정은 민감한 값이 남는다고 판정해요', () => {
    expect(summarize(byId('query-default').answers).verdict).toBe('leak');
  });

  it('토큰만 옮긴 예시는 아직 세 곳에 남아요', () => {
    expect(summarize(byId('body-only').answers).tokenStores).toBe(3);
    expect(summarize(byId('body-only').answers).stores.filter((s) => s.items.length > 0)).toHaveLength(3);
  });

  it('모두 맞춘 예시는 남는 저장소가 없고 응답은 필요한 필드만 있어요', () => {
    const hardened = summarize(byId('hardened').answers);
    expect(hardened.verdict).toBe('none');
    expect(hardened.stores.every((s) => s.items.length === 0)).toBe(true);
    expect(responseFields(byId('hardened').answers)).toEqual(['ok']);
  });
});
