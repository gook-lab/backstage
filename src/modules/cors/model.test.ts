import { describe, expect, it } from 'vitest';
import { type Input, originAllowed, originOf, evaluate, requiresPreflight } from './model';

// 기본값: 페이지(https://shop.example)가 api.shop.example 에 JSON POST 를 보내는 상황
const base: Input = {
  target: 'subdomain',
  method: 'POST',
  headers: ['json'],
  credentials: 'omit',
  allowOrigin: 'none',
  allowCredentials: false,
  allowMethods: 'none',
  allowHeaders: 'none',
  maxAge: null,
  expose: [],
  vary: false,
};

const ok = { ...base, allowOrigin: 'wildcard' as const, allowHeaders: 'list' as const };

describe('동일 출처 판정 (스킴 · 호스트 · 포트 튜플)', () => {
  it('스킴, 호스트, 포트 중 하나만 달라도 다른 출처예요', () => {
    expect(originOf('https://shop.example/a')).toBe('https://shop.example');
    expect(originOf('https://api.shop.example/a')).not.toBe('https://shop.example');
    expect(originOf('http://shop.example/a')).not.toBe('https://shop.example');
    expect(originOf('https://shop.example:8443/a')).not.toBe('https://shop.example');
  });

  it('같은 출처 요청은 프리플라이트 없이 응답을 읽어요', () => {
    const r = evaluate({ ...base, target: 'same', allowOrigin: 'none' });
    expect(r.cross).toBe(false);
    expect(r.preflightNeeded).toBe(false);
    expect(r.readable).toBe(true);
    expect(r.readableHeaders).toEqual(expect.arrayContaining(['Content-Type', 'X-Total-Count', 'Retry-After', 'ETag']));
  });
});

describe('단순 요청과 프리플라이트 조건', () => {
  it('GET 에 안전 목록 헤더만 있으면 단순 요청이에요', () => {
    expect(requiresPreflight({ method: 'GET', headers: [] })).toBe(false);
    expect(requiresPreflight({ method: 'POST', headers: [] })).toBe(false);
  });

  it('DELETE 는 안전 목록 메서드가 아니라서 프리플라이트가 생겨요', () => {
    expect(requiresPreflight({ method: 'DELETE', headers: [] })).toBe(true);
  });

  it('Content-Type: application/json 과 Authorization, 커스텀 헤더는 각각 프리플라이트를 불러요', () => {
    expect(requiresPreflight({ method: 'GET', headers: ['json'] })).toBe(true);
    expect(requiresPreflight({ method: 'GET', headers: ['authorization'] })).toBe(true);
    expect(requiresPreflight({ method: 'GET', headers: ['traceparent'] })).toBe(true);
  });

  it('자격 증명만 include 로 바꾸면 단순 GET 에도 프리플라이트는 생기지 않아요', () => {
    const r = evaluate({
      ...base,
      method: 'GET',
      headers: [],
      credentials: 'include',
      allowOrigin: 'echo',
      allowCredentials: true,
    });
    expect(r.preflightNeeded).toBe(false);
    expect(r.readable).toBe(true);
  });

  it('프리플라이트가 필요 없는 요청은 서버가 헤더를 주지 않아도 서버에 도달해요', () => {
    const r = evaluate({ ...base, method: 'GET', headers: [], allowOrigin: 'none' });
    expect(r.actualSent).toBe(true);
    expect(r.readable).toBe(false);
    expect(r.readableHeaders).toEqual([]);
  });
});

describe('프리플라이트 실패 시 실제 요청', () => {
  it('허락 헤더가 없으면 OPTIONS 만 서버에 가고 실제 요청은 나가지 않아요', () => {
    const r = evaluate(base);
    expect(r.optionsReached).toBe(true);
    expect(r.preflightPassed).toBe(false);
    expect(r.actualSent).toBe(false);
    expect(r.readable).toBe(false);
  });

  it('Allow-Origin 이 요청 출처와 다르면 프리플라이트가 실패해요', () => {
    const r = evaluate({ ...ok, allowOrigin: 'other' });
    expect(r.preflightFailures.map((f) => f.code)).toContain('origin');
    expect(r.actualSent).toBe(false);
  });

  it('요청 출처를 그대로 돌려주면 Allow-Origin 이 맞아요', () => {
    expect(originAllowed('https://shop.example', 'omit')).toBe(true);
    const r = evaluate({ ...ok, allowOrigin: 'echo' });
    expect(r.preflightPassed).toBe(true);
    expect(r.readable).toBe(true);
  });

  it('프리플라이트가 통과하면 실제 요청이 나가고 서버가 처리해요', () => {
    const r = evaluate(ok);
    expect(r.preflightPassed).toBe(true);
    expect(r.actualSent).toBe(true);
    expect(r.readable).toBe(true);
  });
});

describe('Access-Control-Allow-Methods 와 메서드', () => {
  it('DELETE 는 목록에 없으면 프리플라이트가 실패해요', () => {
    const r = evaluate({ ...ok, method: 'DELETE', headers: [], allowMethods: 'none' });
    expect(r.preflightFailures.map((f) => f.code)).toContain('method');
  });

  it('DELETE 가 목록에 있으면 통과해요', () => {
    const r = evaluate({ ...ok, method: 'DELETE', headers: [], allowMethods: 'list' });
    expect(r.preflightPassed).toBe(true);
  });

  it('* 는 자격 증명이 없을 때만 DELETE 를 허락해요', () => {
    const omit = evaluate({ ...ok, method: 'DELETE', headers: [], allowMethods: 'wildcard' });
    expect(omit.preflightPassed).toBe(true);
    const withCookie = evaluate({
      ...ok,
      method: 'DELETE',
      headers: [],
      allowMethods: 'wildcard',
      credentials: 'include',
      allowOrigin: 'echo',
      allowCredentials: true,
    });
    expect(withCookie.preflightFailures.map((f) => f.code)).toContain('method');
  });
});

describe('Access-Control-Allow-Headers 와 Authorization', () => {
  it('커스텀 헤더 traceparent 는 목록에 없으면 프리플라이트가 실패해요', () => {
    const r = evaluate({ ...ok, headers: ['traceparent'], allowHeaders: 'none' });
    expect(r.preflightFailures.map((f) => f.code)).toContain('header');
  });

  it('* 는 자격 증명이 없는 요청에서 커스텀 헤더를 허락해요', () => {
    const r = evaluate({ ...ok, headers: ['traceparent'], allowHeaders: 'wildcard' });
    expect(r.preflightPassed).toBe(true);
  });

  it('Authorization 은 * 로 허락되지 않고 이름을 직접 적어야 해요', () => {
    const star = evaluate({ ...ok, method: 'GET', headers: ['authorization'], allowHeaders: 'wildcard' });
    expect(star.preflightFailures.map((f) => f.code)).toContain('auth-header');
    expect(star.actualSent).toBe(false);

    const listed = evaluate({ ...ok, method: 'GET', headers: ['authorization'], allowHeaders: 'list-auth' });
    expect(listed.preflightPassed).toBe(true);
  });
});

describe('자격 증명 (credentials: include)', () => {
  const withCookie = { ...ok, credentials: 'include' as const };

  it('자격 증명을 보내는 요청에는 Allow-Origin 에 * 를 쓸 수 없어요', () => {
    const r = evaluate({ ...withCookie, allowOrigin: 'wildcard', allowCredentials: true });
    expect(r.preflightFailures.map((f) => f.code)).toContain('wildcard-credentials');
    expect(r.readable).toBe(false);
    expect(r.consoleHint).toContain('Credential is not supported');
  });

  it('요청 출처를 그대로 쓰고 Allow-Credentials: true 를 주면 응답을 읽어요', () => {
    const r = evaluate({ ...withCookie, allowOrigin: 'echo', allowCredentials: true });
    expect(r.preflightPassed).toBe(true);
    expect(r.readable).toBe(true);
  });

  it('Allow-Credentials 가 없으면 프리플라이트부터 실패해요', () => {
    const r = evaluate({ ...withCookie, allowOrigin: 'echo', allowCredentials: false });
    expect(r.preflightFailures.map((f) => f.code)).toContain('allow-credentials');
    expect(r.actualSent).toBe(false);
  });

  it('프리플라이트는 자격 증명 없이 나가므로 쿠키 설정이 OPTIONS 를 바꾸지 않아요', () => {
    const r = evaluate({ ...withCookie, allowOrigin: 'echo', allowCredentials: true });
    expect(r.steps.find((s) => s.id === 'preflight')?.detail).toContain('자격 증명 없이');
  });

  it('쿠키 정책 안내는 자격 증명을 보낼 때만 나와요', () => {
    expect(evaluate(ok).steps.some((s) => s.id === 'cookie')).toBe(false);
    expect(
      evaluate({ ...withCookie, allowOrigin: 'echo', allowCredentials: true }).steps.some((s) => s.id === 'cookie'),
    ).toBe(true);
  });
});

describe('응답 헤더 읽기 (Expose-Headers)', () => {
  it('Content-Type 은 기본으로 읽히고, 나머지는 Expose-Headers 에 있어야 읽혀요', () => {
    const none = evaluate({ ...ok, expose: [] });
    expect(none.readableHeaders).toEqual(['Content-Type']);

    const some = evaluate({ ...ok, expose: ['X-Total-Count', 'ETag'] });
    expect(some.readableHeaders).toEqual(['Content-Type', 'X-Total-Count', 'ETag']);
  });

  it('Expose-Headers 가 없으면 프리플라이트가 통과해도 X-Total-Count 를 JS 가 읽지 못해요', () => {
    const r = evaluate({ ...ok, expose: [] });
    expect(r.readable).toBe(true);
    expect(r.readableHeaders).not.toContain('X-Total-Count');
  });
});

describe('프리플라이트 캐시와 Vary', () => {
  it('Max-Age 를 주면 캐시 안내에 그 초가 들어가요', () => {
    const r = evaluate({ ...ok, maxAge: 600 });
    expect(r.steps.find((s) => s.id === 'cache')?.detail).toContain('600초');
  });

  it('Max-Age 가 없으면 브라우저 기본 5초를 말해요', () => {
    const r = evaluate({ ...ok, maxAge: null });
    expect(r.steps.find((s) => s.id === 'cache')?.detail).toContain('5초');
  });

  it('프리플라이트가 필요 없으면 캐시 안내를 만들지 않아요', () => {
    const r = evaluate({ ...ok, headers: [], method: 'GET', maxAge: 600 });
    expect(r.steps.some((s) => s.id === 'cache')).toBe(false);
  });

  it('요청 출처를 그대로 쓰면서 Vary: Origin 이 없으면 경고를 줘요', () => {
    const r = evaluate({ ...ok, allowOrigin: 'echo', vary: false });
    expect(r.steps.find((s) => s.id === 'vary')?.status).toBe('warn');
  });

  it('Vary: Origin 을 주면 경고가 사라져요', () => {
    const r = evaluate({ ...ok, allowOrigin: 'echo', vary: true });
    expect(r.steps.some((s) => s.id === 'vary')).toBe(false);
  });
});

describe('콘솔 문구 예시', () => {
  it('실패가 없으면 콘솔 문구가 없어요', () => {
    expect(evaluate(ok).consoleHint).toBeNull();
  });

  it('첫 실패의 문구를 골라요', () => {
    expect(evaluate(base).consoleHint).toContain('Access-Control-Allow-Origin');
  });
});
