import { describe, expect, it } from 'vitest';
import {
  type Config,
  evaluate,
  evaluateHsts,
  POLICY_PRESETS,
  PARTNER_ORIGIN,
  type ResourceId,
  type ResourceResult,
  RESOURCES,
  referrerFor,
} from './model';

const ALL: ResourceId[] = RESOURCES.map((r) => r.id);
const NONCE_POLICY = POLICY_PRESETS[0].text;
const LEGACY_POLICY = POLICY_PRESETS[1].text;

const base: Config = {
  policy: NONCE_POLICY,
  reportOnly: false,
  xfo: 'none',
  nosniff: true,
  hsts: 'none',
  hstsSentOver: 'https',
  nextRequest: 'http://shop.example/cart',
  referrer: 'strict-origin-when-cross-origin',
  loaded: ALL,
};

const one = (cfg: Config, id: ResourceId): ResourceResult => {
  const r = evaluate(cfg).resources.find((x) => x.id === id);
  if (!r) throw new Error(`no resource ${id}`);
  return r;
};

describe('CSP 지시문 판정 (nonce · 해시 · 출처)', () => {
  it('nonce 정책에서는 맞는 nonce 가 붙은 인라인 스크립트만 통과해요', () => {
    expect(one(base, 'nonce').verdict).toBe('allowed');
    expect(one(base, 'inline').verdict).toBe('blocked');
    expect(one(base, 'inline').reason).toContain('nonce');
  });

  it('본문 해시가 정책에 있으면 nonce 없이도 인라인 스크립트가 통과해요', () => {
    expect(one(base, 'hash').verdict).toBe('allowed');
    const wrong = { ...base, policy: "script-src 'self' 'sha256-AAAA'" };
    expect(one(wrong, 'hash').verdict).toBe('blocked');
  });

  it("'unsafe-inline' 은 nonce 나 해시가 있으면 무시돼요", () => {
    const mixed = { ...base, policy: `script-src 'self' 'unsafe-inline' 'nonce-${'k3Yq7vN2bX'}'` };
    const inline = one(mixed, 'inline');
    expect(inline.verdict).toBe('blocked');
    expect(inline.reason).toContain("'unsafe-inline' 은 무시돼요");
  });

  it('같은 출처 스크립트는 self 로 통과하고 외부 분석 스크립트는 막혀요', () => {
    expect(one(base, 'self-js').verdict).toBe('allowed');
    const analytics = one(base, 'analytics-js');
    expect(analytics.verdict).toBe('blocked');
    expect(analytics.reason).toContain('https://cdn.analytics.example');
  });

  it('예전 정책의 unsafe-inline 과 호스트 허용으로는 인라인과 외부 스크립트가 함께 통과해요', () => {
    const legacy = { ...base, policy: LEGACY_POLICY };
    expect(one(legacy, 'inline').verdict).toBe('allowed');
    expect(one(legacy, 'analytics-js').verdict).toBe('allowed');
  });

  it('정책이 없으면 아무 자원도 막지 않아요', () => {
    const none = { ...base, policy: '', nosniff: false };
    const r = evaluate(none);
    expect(r.blocked).toBe(0);
    expect(r.resources.every((x) => x.verdict === 'allowed')).toBe(true);
  });

  it('같은 지시문이 두 번 나오면 첫 번째만 적용돼요', () => {
    const dup = { ...base, policy: "script-src 'none'; script-src 'self' 'nonce-k3Yq7vN2bX'" };
    expect(one(dup, 'nonce').verdict).toBe('blocked');
  });
});

describe('대체 지시문 (fallback)', () => {
  it('img-src 가 없으면 default-src 가 이미지를 판정해요', () => {
    const cfg = { ...base, policy: "default-src 'self'" };
    const img = one(cfg, 'img');
    expect(img.verdict).toBe('blocked');
    expect(img.directive).toBe('img-src');
  });

  it('connect-src 가 없으면 fetch 도 default-src 를 따라요', () => {
    const cfg = { ...base, policy: "default-src 'self' https://collect.analytics.example" };
    expect(one(cfg, 'beacon').verdict).toBe('allowed');
    expect(one({ ...base, policy: "default-src 'self'" }, 'beacon').verdict).toBe('blocked');
  });
});

describe('Report-Only 모드', () => {
  it('위반은 보고만 하고 자원은 그대로 로드해요', () => {
    const cfg = { ...base, reportOnly: true, nosniff: false };
    const r = evaluate(cfg);
    expect(one(cfg, 'inline').verdict).toBe('reported');
    expect(one(cfg, 'analytics-js').verdict).toBe('reported');
    expect(r.blocked).toBe(0);
    expect(r.reported).toBeGreaterThan(0);
  });
});

describe('삽입 판정 (frame-ancestors · X-Frame-Options)', () => {
  const embed = (cfg: Config) => one(cfg, 'embed');

  it("frame-ancestors 'none' 이면 파트너 삽입을 막아요", () => {
    const r = embed(base);
    expect(r.verdict).toBe('blocked');
    expect(r.directive).toBe('frame-ancestors');
  });

  it('frame-ancestors 가 허락하면 X-Frame-Options: DENY 는 무시돼요', () => {
    const cfg = { ...base, policy: `frame-ancestors ${PARTNER_ORIGIN}`, xfo: 'DENY' as const };
    expect(embed(cfg).verdict).toBe('allowed');
  });

  it('frame-ancestors 가 Report-Only 면 X-Frame-Options 를 무시하지 않아요', () => {
    const cfg = { ...base, policy: `frame-ancestors ${PARTNER_ORIGIN}`, reportOnly: true, xfo: 'DENY' as const };
    expect(embed(cfg).verdict).toBe('blocked');
    expect(embed(cfg).directive).toBe('X-Frame-Options');
  });

  it('frame-ancestors 가 없으면 SAMEORIGIN 이 다른 출처의 삽입을 막아요', () => {
    const cfg = { ...base, policy: '', xfo: 'SAMEORIGIN' as const };
    expect(embed(cfg).verdict).toBe('blocked');
    expect(embed(cfg).directive).toBe('X-Frame-Options');
  });

  it('헤더가 없으면 삽입을 막지 않아요', () => {
    expect(embed({ ...base, policy: '' }).verdict).toBe('allowed');
  });
});

describe('nosniff 와 스크립트 MIME', () => {
  it('nosniff 가 있으면 text/plain 스크립트를 실행하지 않아요', () => {
    const cfg = { ...base, policy: LEGACY_POLICY, nosniff: true };
    const r = one(cfg, 'legacy-js');
    expect(r.verdict).toBe('blocked');
    expect(r.directive).toBe('X-Content-Type-Options');
  });

  it('nosniff 가 없으면 같은 자원을 막지 않아요', () => {
    const cfg = { ...base, policy: LEGACY_POLICY, nosniff: false };
    expect(one(cfg, 'legacy-js').verdict).toBe('allowed');
  });
});

describe('HSTS 적용 범위', () => {
  const hstsCfg = (over: Partial<Config>): Config => ({ ...base, hsts: 'basic', ...over });

  it('HTTP 로 받은 응답의 HSTS 헤더는 무시해요', () => {
    const r = evaluateHsts(hstsCfg({ hstsSentOver: 'http', nextRequest: 'http://shop.example/cart' }));
    expect(r.applied).toBe(false);
    expect(r.finalUrl).toBe('http://shop.example/cart');
  });

  it('HTTPS 로 받은 HSTS 는 같은 호스트의 http 요청을 https 로 바꿔요', () => {
    const r = evaluateHsts(hstsCfg({ nextRequest: 'http://shop.example/cart' }));
    expect(r.applied).toBe(true);
    expect(r.finalUrl).toBe('https://shop.example/cart');
  });

  it('includeSubDomains 가 없으면 서브도메인 요청은 그대로 http 로 나가요', () => {
    const r = evaluateHsts(hstsCfg({ nextRequest: 'http://api.shop.example/api/cart' }));
    expect(r.applied).toBe(false);
    expect(r.finalUrl).toBe('http://api.shop.example/api/cart');
  });

  it('includeSubDomains 가 있으면 서브도메인 요청도 https 로 바꿔요', () => {
    const r = evaluateHsts(hstsCfg({ hsts: 'subdomains', nextRequest: 'http://api.shop.example/api/cart' }));
    expect(r.applied).toBe(true);
    expect(r.finalUrl).toBe('https://api.shop.example/api/cart');
  });
});

describe('Referrer-Policy 와 교차 출처 fetch', () => {
  it('기본 값은 교차 출처에 출처(origin)만 보내요', () => {
    expect(referrerFor('strict-origin-when-cross-origin')).toBe('https://shop.example/');
  });

  it('same-origin 은 교차 출처 요청에 Referer 를 보내지 않아요', () => {
    expect(referrerFor('same-origin')).toBeNull();
  });

  it('unsafe-url 은 경로와 쿼리까지 보내요', () => {
    expect(referrerFor('unsafe-url')).toBe('https://shop.example/cart?coupon=SPRING');
  });

  it('no-referrer 는 Referer 를 보내지 않아요', () => {
    expect(evaluate({ ...base, referrer: 'no-referrer' }).referrerSent).toBeNull();
  });
});

describe('자원 선택', () => {
  it('로드하지 않은 자원은 건너뛰어요', () => {
    const cfg = { ...base, loaded: ['inline' as const] };
    const r = evaluate(cfg);
    expect(one(cfg, 'analytics-js').verdict).toBe('skipped');
    expect(r.blocked).toBe(1);
  });
});
