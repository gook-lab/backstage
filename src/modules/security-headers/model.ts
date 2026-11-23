// 브라우저가 CSP · 프레이밍 · 보안 응답 헤더를 판정하는 순수 함수.
// 규칙 출처: MDN CSP · script-src · frame-ancestors · Report-Only · X-Frame-Options · X-Content-Type-Options · Referrer-Policy · HSTS 문서,
// W3C CSP Level 3, RFC 6797 §8.1. 실제 브라우저의 세부 구현은 다를 수 있어요.

export const PAGE_ORIGIN = 'https://shop.example';
export const PAGE_URL = 'https://shop.example/cart?coupon=SPRING';
/** 서버가 이번 응답마다 새로 만든 nonce 라고 가정하는 값 */
export const PAGE_NONCE = 'k3Yq7vN2bX';
/** READY_SCRIPT 본문(바이트 그대로)의 SHA-256 base64 값 */
export const READY_SCRIPT = 'console.log("ready");';
export const READY_HASH = '1eibjuhpRz9UB9uxgoXzIqDUOe6eJEAyeM72MwtRe4M=';
export const PARTNER_ORIGIN = 'https://partner.example';

/** 시뮬레이터 프리셋 정책 문자열 */
export const POLICY_PRESETS: readonly { id: string; label: string; text: string }[] = [
  {
    id: 'nonce',
    label: 'nonce · 해시 기반 (권장)',
    text: `default-src 'self'; script-src 'self' 'nonce-${PAGE_NONCE}' 'sha256-${READY_HASH}'; img-src 'self' https://img.cdn.example; connect-src 'self' https://api.shop.example; frame-ancestors 'none'`,
  },
  {
    id: 'legacy',
    label: "'unsafe-inline' 허용 (예전 방식)",
    text: `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.analytics.example; img-src 'self' https://img.cdn.example; connect-src 'self' https://api.shop.example`,
  },
  { id: 'none', label: '정책 없음', text: '' },
];

export type Directives = Readonly<Record<string, readonly string[]>>;

/** 같은 지시문이 두 번 나오면 첫 번째만 써요(CSP3). 값은 공백 기준으로 나눠요. */
export function parsePolicy(text: string): Directives {
  const out: Record<string, string[]> = {};
  for (const part of text.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (name in out) continue;
    out[name] = tokens.slice(1);
  }
  return out;
}

/** 더 세부적인 지시문이 없을 때 넘어가는 대체 지시문 */
const FALLBACK: Readonly<Record<string, readonly string[]>> = {
  'script-src-elem': ['script-src', 'default-src'],
  'img-src': ['default-src'],
  'connect-src': ['default-src'],
};

/** 지시문 값을 찾아요. 없으면 null 이고 정책이 없는 것과 같아요. */
export function effective(d: Directives, name: string): readonly string[] | null {
  for (const n of [name, ...(FALLBACK[name] ?? [])]) {
    if (n in d) return d[n];
  }
  return null;
}

export type ResourceId =
  'inline' | 'nonce' | 'hash' | 'self-js' | 'analytics-js' | 'img' | 'beacon' | 'legacy-js' | 'embed';

export interface Resource {
  readonly id: ResourceId;
  readonly label: string;
  readonly kind: 'inline' | 'script' | 'image' | 'fetch' | 'embed';
  /** 자원 주소 (인라인과 삽입은 없어요) */
  readonly url?: string;
  readonly nonce?: string;
  /** 'sha256-…' 형식 해시. 인라인 스크립트 본문에서 계산한 값 */
  readonly hash?: string;
  /** 서버가 보내는 Content-Type. 생략하면 JS 로 봐요 */
  readonly mime?: string;
  /** 삽입 시도 자원에서 삽입하는 부모 출처 */
  readonly parent?: string;
}

export const RESOURCES: readonly Resource[] = [
  { id: 'inline', label: '인라인 <script> (nonce · 해시 없음)', kind: 'inline' },
  { id: 'nonce', label: `nonce 붙은 인라인 <script nonce="${PAGE_NONCE}">`, kind: 'inline', nonce: PAGE_NONCE },
  { id: 'hash', label: 'console.log("ready") 인라인 <script> (해시 일치)', kind: 'inline', hash: READY_HASH },
  { id: 'self-js', label: '같은 출처 스크립트 /app.js', kind: 'script', url: `${PAGE_ORIGIN}/app.js` },
  {
    id: 'analytics-js',
    label: '외부 분석 스크립트 cdn.analytics.example',
    kind: 'script',
    url: 'https://cdn.analytics.example/a.js',
  },
  {
    id: 'legacy-js',
    label: '같은 출처 /legacy.js (Content-Type: text/plain)',
    kind: 'script',
    url: `${PAGE_ORIGIN}/legacy.js`,
    mime: 'text/plain',
  },
  { id: 'img', label: '이미지 img.cdn.example', kind: 'image', url: 'https://img.cdn.example/hero.webp' },
  {
    id: 'beacon',
    label: 'fetch 로 이벤트 전송 collect.analytics.example',
    kind: 'fetch',
    url: 'https://collect.analytics.example/e',
  },
  { id: 'embed', label: '파트너 사이트가 이 페이지를 iframe 으로 삽입', kind: 'embed', parent: PARTNER_ORIGIN },
];

export type XfoValue = 'none' | 'DENY' | 'SAMEORIGIN';
export type HstsValue = 'none' | 'basic' | 'subdomains';
export type SentOver = 'https' | 'http';
export type ReferrerValue = 'no-referrer' | 'origin' | 'same-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';

export const REFERRER_VALUES: readonly ReferrerValue[] = [
  'no-referrer',
  'origin',
  'same-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
];

export interface Config {
  readonly policy: string;
  readonly reportOnly: boolean;
  readonly xfo: XfoValue;
  readonly nosniff: boolean;
  readonly hsts: HstsValue;
  readonly hstsSentOver: SentOver;
  readonly nextRequest: string;
  readonly referrer: ReferrerValue;
  /** 페이지가 실제로 로드하려는 자원 id 목록 */
  readonly loaded: readonly ResourceId[];
}

export type Verdict = 'allowed' | 'blocked' | 'reported' | 'skipped';

export interface ResourceResult {
  readonly id: ResourceId;
  readonly label: string;
  readonly verdict: Verdict;
  readonly directive: string | null;
  readonly reason: string;
}

export interface HstsResult {
  readonly applied: boolean;
  readonly requestUrl: string;
  readonly finalUrl: string;
  readonly reason: string;
}

export interface Result {
  readonly resources: readonly ResourceResult[];
  readonly blocked: number;
  readonly reported: number;
  readonly hsts: HstsResult;
  /** 교차 출처 fetch 에 실리는 Referer 값. 없으면 null */
  readonly referrerSent: string | null;
}

const hostOf = (url: string): string => new URL(url).hostname;
const originOf = (url: string): string => new URL(url).origin;

/** 출처 식별자 한 개가 주소와 맞는지 봐요. 키워드(nonce · 해시 · unsafe-inline)는 주소와 비교하지 않아요. */
export function sourceMatches(source: string, url: string): boolean {
  if (source === "'self'") return originOf(url) === PAGE_ORIGIN;
  if (source === '*') return /^https?:$/.test(new URL(url).protocol);
  if (source.startsWith("'")) return false;
  const m = /^(?:(https?):\/\/)?(\*\.)?([a-z0-9.-]+)(?::\d+)?(?:\/.*)?$/.exec(source);
  if (!m) return false;
  const u = new URL(url);
  if (m[1] && m[1] + ':' !== u.protocol) return false;
  return m[2] ? u.hostname.endsWith(`.${m[3]}`) : u.hostname === m[3];
}

interface Check {
  readonly violates: boolean;
  readonly directive: string | null;
  readonly reason: string;
}

const PASS: Check = { violates: false, directive: null, reason: '' };

/** 인라인 스크립트는 nonce · 해시가 맞거나 unsafe-inline 이 있어야 해요. nonce · 해시가 있으면 unsafe-inline 은 무시돼요. */
function checkInline(r: Resource, list: readonly string[]): Check {
  const directive = 'script-src-elem';
  const hasNonceOrHash = list.some((s) => s.startsWith("'nonce-") || s.startsWith("'sha256-"));
  if (r.nonce !== undefined && list.includes(`'nonce-${r.nonce}'`)) return PASS;
  if (r.hash !== undefined && list.includes(`'sha256-${r.hash}'`)) return PASS;
  if (!hasNonceOrHash && list.includes("'unsafe-inline'")) return PASS;
  if (list.includes("'unsafe-inline'") && hasNonceOrHash) {
    return {
      violates: true,
      directive,
      reason: "정책에 nonce 나 해시가 있어서 'unsafe-inline' 은 무시돼요. 이 스크립트는 맞는 nonce 나 해시가 없어요",
    };
  }
  if (r.nonce !== undefined) {
    return { violates: true, directive, reason: `script-src 에 'nonce-${r.nonce}' 가 없어서 막혀요` };
  }
  if (r.hash !== undefined) {
    return { violates: true, directive, reason: 'script-src 에 이 본문의 해시가 없어서 막혀요' };
  }
  return {
    violates: true,
    directive,
    reason: "nonce 나 해시가 없고 'unsafe-inline' 도 없어서 인라인 스크립트를 막아요",
  };
}

/** 주소 기반 자원(스크립트 · 이미지 · fetch)의 출처 목록 검사 */
function checkUrl(r: Resource, list: readonly string[] | null, directive: string): Check {
  if (list === null) return PASS;
  const url = r.url as string;
  if (list.some((s) => sourceMatches(s, url))) return PASS;
  return { violates: true, directive, reason: `${directive} 에 ${originOf(url)} 이 없어서 막혀요` };
}

function checkCsp(r: Resource, d: Directives): Check {
  if (r.kind === 'inline') {
    const list = effective(d, 'script-src-elem');
    return list === null ? PASS : checkInline(r, list);
  }
  if (r.kind === 'script') return checkUrl(r, effective(d, 'script-src-elem'), 'script-src-elem');
  if (r.kind === 'image') return checkUrl(r, effective(d, 'img-src'), 'img-src');
  if (r.kind === 'fetch') return checkUrl(r, effective(d, 'connect-src'), 'connect-src');
  return PASS;
}

/** 삽입 허용 판정. frame-ancestors 가 enforce 일 때만 X-Frame-Options 를 무시해요. */
function checkFraming(
  parent: string,
  cfg: Config,
  d: Directives,
): { verdict: Verdict; directive: string | null; reason: string } {
  const fa = d['frame-ancestors'];
  const faEnforced = fa !== undefined && !cfg.reportOnly;
  if (faEnforced) {
    const ok = fa.some((s) => sourceMatches(s, parent));
    if (!ok) {
      return {
        verdict: 'blocked',
        directive: 'frame-ancestors',
        reason: `frame-ancestors 에 ${parent} 이 없어서 삽입을 막아요`,
      };
    }
    return {
      verdict: 'allowed',
      directive: 'frame-ancestors',
      reason: 'frame-ancestors 가 삽입을 허락해요. X-Frame-Options 는 무시해요',
    };
  }
  if (cfg.xfo === 'DENY') {
    return {
      verdict: 'blocked',
      directive: 'X-Frame-Options',
      reason: 'X-Frame-Options: DENY 라서 어떤 출처도 삽입할 수 없어요',
    };
  }
  if (cfg.xfo === 'SAMEORIGIN' && parent !== PAGE_ORIGIN) {
    return {
      verdict: 'blocked',
      directive: 'X-Frame-Options',
      reason: 'X-Frame-Options: SAMEORIGIN 이라서 다른 출처의 삽입을 막아요',
    };
  }
  return { verdict: 'allowed', directive: null, reason: '삽입을 막는 헤더나 지시문이 없어요' };
}

function evaluateResource(r: Resource, cfg: Config, d: Directives): ResourceResult {
  if (!cfg.loaded.includes(r.id)) {
    return { id: r.id, label: r.label, verdict: 'skipped', directive: null, reason: '이번 요청에서 로드하지 않아요' };
  }
  if (r.kind === 'embed') {
    const f = checkFraming(r.parent as string, cfg, d);
    return { id: r.id, label: r.label, ...f };
  }
  const csp = checkCsp(r, d);
  if (csp.violates && !cfg.reportOnly) {
    return { id: r.id, label: r.label, verdict: 'blocked', directive: csp.directive, reason: csp.reason };
  }
  if (r.kind === 'script' && cfg.nosniff && r.mime !== undefined && !/javascript/.test(r.mime)) {
    return {
      id: r.id,
      label: r.label,
      verdict: 'blocked',
      directive: 'X-Content-Type-Options',
      reason: `nosniff 때문에 Content-Type ${r.mime} 스크립트를 실행하지 않아요`,
    };
  }
  if (csp.violates) {
    return {
      id: r.id,
      label: r.label,
      verdict: 'reported',
      directive: csp.directive,
      reason: `Report-Only 라서 막지 않고 위반만 보고해요. ${csp.reason}`,
    };
  }
  return { id: r.id, label: r.label, verdict: 'allowed', directive: null, reason: '정책이 허락해요' };
}

/** HSTS: HTTP 로 받은 응답의 헤더는 무시해요(RFC 6797 §8.1). 적용되면 해당 호스트의 http 요청을 https 로 바꿔요. */
export function evaluateHsts(cfg: Config): HstsResult {
  const requestUrl = cfg.nextRequest;
  const host = hostOf(requestUrl);
  if (cfg.hsts === 'none') {
    return {
      applied: false,
      requestUrl,
      finalUrl: requestUrl,
      reason: 'HSTS 헤더가 없어요. http 요청은 그대로 나가요',
    };
  }
  if (cfg.hstsSentOver === 'http') {
    return {
      applied: false,
      requestUrl,
      finalUrl: requestUrl,
      reason: 'HTTP 로 받은 응답의 HSTS 헤더는 무시해요. 기억되지 않아요',
    };
  }
  const sub = cfg.hsts === 'subdomains';
  const known = host === 'shop.example' || (sub && host.endsWith('.shop.example'));
  if (!known) {
    return {
      applied: false,
      requestUrl,
      finalUrl: requestUrl,
      reason: sub ? `${host} 는 HSTS 대상이 아니에요` : 'includeSubDomains 가 없어서 서브도메인에는 적용되지 않아요',
    };
  }
  const finalUrl = requestUrl.replace(/^http:/, 'https:');
  return {
    applied: requestUrl.startsWith('http:'),
    requestUrl,
    finalUrl,
    reason: requestUrl.startsWith('http:')
      ? '기억된 HSTS 정책이 있어서 https 로 바꿔 요청해요'
      : '이미 https 주소라서 바꿀 것이 없어요',
  };
}

/** 교차 출처 fetch 에 실리는 Referer. 대상이 다른 출처이고 https 라고 가정해요. */
export function referrerFor(policy: ReferrerValue): string | null {
  switch (policy) {
    case 'no-referrer':
      return null;
    case 'origin':
      return `${PAGE_ORIGIN}/`;
    case 'same-origin':
      return null;
    case 'strict-origin-when-cross-origin':
      return `${PAGE_ORIGIN}/`;
    case 'unsafe-url':
      return PAGE_URL;
  }
}

export function evaluate(cfg: Config): Result {
  const d = parsePolicy(cfg.policy);
  const resources = RESOURCES.map((r) => evaluateResource(r, cfg, d));
  return {
    resources,
    blocked: resources.filter((r) => r.verdict === 'blocked').length,
    reported: resources.filter((r) => r.verdict === 'reported').length,
    hsts: evaluateHsts(cfg),
    referrerSent: referrerFor(cfg.referrer),
  };
}
