// 브라우저가 교차 출처 요청을 어떻게 처리하는지 판정하는 순수 함수.
// 규칙 출처: MDN CORS 가이드 · MDN 헤더 문서 · WHATWG Fetch 표준(CORS-preflight fetch, CORS check).

export const PAGE_ORIGIN = 'https://shop.example';

export type Method = 'GET' | 'POST' | 'DELETE';
export const METHODS: readonly Method[] = ['GET', 'POST', 'DELETE'];

/** 안전 목록 밖이라 프리플라이트를 부르는 요청 헤더들 */
export type ReqHeader = 'json' | 'authorization' | 'traceparent';
export const REQ_HEADERS: readonly ReqHeader[] = ['json', 'authorization', 'traceparent'];
export const REQ_HEADER_LABEL: Record<ReqHeader, string> = {
  json: 'Content-Type: application/json',
  authorization: 'Authorization',
  traceparent: 'traceparent (커스텀)',
};
const REQ_HEADER_NAME: Record<ReqHeader, string> = {
  json: 'Content-Type',
  authorization: 'Authorization',
  traceparent: 'traceparent',
};

export type Credentials = 'omit' | 'include';

export type TargetId = 'same' | 'subdomain' | 'scheme' | 'port';
export const TARGETS: readonly { id: TargetId; label: string; url: string }[] = [
  { id: 'same', label: '같은 출처', url: 'https://shop.example/api/cart' },
  { id: 'subdomain', label: '호스트만 다름 (api.shop.example)', url: 'https://api.shop.example/api/cart' },
  { id: 'scheme', label: '스킴만 다름 (http)', url: 'http://shop.example/api/cart' },
  { id: 'port', label: '포트만 다름 (:8443)', url: 'https://shop.example:8443/api/cart' },
];

export type AllowOrigin = 'none' | 'wildcard' | 'echo' | 'other';
export const ALLOW_ORIGIN_VALUE: Record<AllowOrigin, string | null> = {
  none: null,
  wildcard: '*',
  echo: PAGE_ORIGIN,
  other: 'https://admin.shop.example',
};

export type AllowMethods = 'none' | 'list' | 'wildcard';
export const ALLOW_METHOD_LIST: readonly string[] = ['POST', 'DELETE'];

export type AllowHeaders = 'none' | 'list' | 'list-auth' | 'wildcard';
export const ALLOW_HEADER_LIST: readonly string[] = ['Content-Type', 'traceparent'];

export type RespHeader = 'X-Total-Count' | 'Retry-After' | 'ETag';
export const RESP_HEADERS: readonly RespHeader[] = ['X-Total-Count', 'Retry-After', 'ETag'];

/** 응답에는 항상 실리지만 JS 에서 읽는 것은 CORS-safelisted 헤더와 Expose-Headers 목록뿐이에요 */
const SAFELISTED_RESPONSE_HEADERS: readonly string[] = ['Content-Type'];

export interface Input {
  readonly target: TargetId;
  readonly method: Method;
  readonly headers: readonly ReqHeader[];
  readonly credentials: Credentials;
  readonly allowOrigin: AllowOrigin;
  readonly allowCredentials: boolean;
  readonly allowMethods: AllowMethods;
  readonly allowHeaders: AllowHeaders;
  /** null 이면 헤더를 보내지 않아요. 브라우저 기본값은 5초예요 */
  readonly maxAge: number | null;
  readonly expose: readonly RespHeader[];
  readonly vary: boolean;
}

export type StepStatus = 'pass' | 'fail' | 'skip' | 'info' | 'warn';

export interface Step {
  readonly id: string;
  readonly title: string;
  readonly status: StepStatus;
  readonly detail: string;
}

export type FailureCode = 'origin' | 'wildcard-credentials' | 'method' | 'header' | 'auth-header' | 'allow-credentials';

export interface Failure {
  readonly code: FailureCode;
  readonly text: string;
}

export interface Result {
  readonly origin: string;
  readonly cross: boolean;
  readonly preflightReasons: readonly string[];
  readonly preflightNeeded: boolean;
  /** OPTIONS 가 서버에 도달했는지 */
  readonly optionsReached: boolean;
  readonly preflightPassed: boolean;
  /** 실제 요청(GET · POST · DELETE)이 서버에 도달했는지 */
  readonly actualSent: boolean;
  readonly readable: boolean;
  readonly readableHeaders: readonly string[];
  readonly preflightFailures: readonly Failure[];
  readonly readFailures: readonly Failure[];
  /** 개발자 콘솔에서 볼 법한 문구 예시. 실제 문구는 브라우저마다 달라요 */
  readonly consoleHint: string | null;
  readonly steps: readonly Step[];
}

const SAFE_METHODS: readonly Method[] = ['GET', 'POST'];

/** 요청이 프리플라이트를 부르는 이유 목록. 비어 있으면 단순 요청이에요 */
export function preflightReasons(input: Pick<Input, 'method' | 'headers'>): string[] {
  const reasons: string[] = [];
  if (!SAFE_METHODS.includes(input.method)) {
    reasons.push(`${input.method} 는 안전 목록 메서드(GET · HEAD · POST)가 아니에요.`);
  }
  for (const h of input.headers) {
    if (h === 'json') {
      reasons.push('Content-Type: application/json 은 안전 목록 값(form · multipart · text/plain)이 아니에요.');
    } else if (h === 'authorization') {
      reasons.push('Authorization 헤더는 안전 목록에 없어요.');
    } else {
      reasons.push('traceparent 는 안전 목록에 없는 커스텀 헤더예요.');
    }
  }
  return reasons;
}

/** 자격 증명(credentials)만으로는 프리플라이트가 생기지 않아요. 단순 GET 에 include 를 줘도 OPTIONS 는 없어요 */
export function requiresPreflight(input: Pick<Input, 'method' | 'headers'>): boolean {
  return preflightReasons(input).length > 0;
}

export function originOf(url: string): string {
  return new URL(url).origin;
}

/** ACAO 값이 이 요청을 허락하는지. 자격 증명을 보내면 * 는 허락으로 치지 않아요 */
export function originAllowed(acao: string | null, credentials: Credentials): boolean {
  if (acao === null) return false;
  if (acao === '*') return credentials === 'omit';
  return acao === PAGE_ORIGIN;
}

function methodAllowed(method: Method, input: Input): boolean {
  if (SAFE_METHODS.includes(method)) return true;
  if (input.allowMethods === 'wildcard') return input.credentials === 'omit';
  if (input.allowMethods === 'list') return ALLOW_METHOD_LIST.includes(method);
  return false;
}

function allowedHeaderList(policy: AllowHeaders): readonly string[] {
  if (policy === 'list') return ALLOW_HEADER_LIST;
  if (policy === 'list-auth') return [...ALLOW_HEADER_LIST, 'Authorization'];
  return [];
}

function headerAllowed(name: string, input: Input): boolean {
  const listed = allowedHeaderList(input.allowHeaders).some((x) => x.toLowerCase() === name.toLowerCase());
  // Authorization 은 * 로 허용되지 않고 이름을 직접 적어야 해요 (Fetch: CORS non-wildcard request-header name)
  if (name === 'Authorization') return listed;
  if (input.allowHeaders === 'wildcard') return input.credentials === 'omit';
  return listed;
}

function originFailures(input: Input, stage: 'preflight' | 'read'): Failure[] {
  if (input.credentials === 'include' && input.allowOrigin === 'wildcard') {
    const text =
      stage === 'preflight'
        ? '자격 증명을 보내는 요청에는 Access-Control-Allow-Origin 에 * 를 쓸 수 없어요.'
        : '자격 증명을 보내는 요청에는 * 응답을 읽을 수 없어요.';
    return [{ code: 'wildcard-credentials', text }];
  }
  if (!originAllowed(ALLOW_ORIGIN_VALUE[input.allowOrigin], input.credentials)) {
    return [{ code: 'origin', text: originFailText(input) }];
  }
  return [];
}

function preflightCheck(input: Input): Failure[] {
  const failures: Failure[] = [];
  failures.push(...originFailures(input, 'preflight'));
  if (!methodAllowed(input.method, input)) {
    failures.push({ code: 'method', text: `Access-Control-Allow-Methods 에 ${input.method} 가 없어요.` });
  }
  const missing = input.headers.map((h) => REQ_HEADER_NAME[h]).filter((n) => !headerAllowed(n, input));
  if (missing.length > 0) {
    const onlyAuth = missing.every((n) => n === 'Authorization');
    failures.push(
      onlyAuth
        ? {
            code: 'auth-header',
            text: 'Authorization 은 * 로 허용되지 않아요. Access-Control-Allow-Headers 에 이름을 직접 적어야 해요.',
          }
        : {
            code: 'header',
            text: `Access-Control-Allow-Headers 에 ${missing.join(', ')} 가 없어요.`,
          },
    );
  }
  if (input.credentials === 'include' && !input.allowCredentials) {
    failures.push({
      code: 'allow-credentials',
      text: 'Access-Control-Allow-Credentials: true 가 없어요.',
    });
  }
  return failures;
}

function originFailText(input: Input): string {
  const v = ALLOW_ORIGIN_VALUE[input.allowOrigin];
  if (v === null) return 'Access-Control-Allow-Origin 헤더가 없어요.';
  return `Access-Control-Allow-Origin 이 ${v} 라서 요청 출처 ${PAGE_ORIGIN} 과 맞지 않아요.`;
}

function readCheck(input: Input): Failure[] {
  const failures: Failure[] = [...originFailures(input, 'read')];
  if (input.credentials === 'include' && !input.allowCredentials) {
    failures.push({ code: 'allow-credentials', text: 'Access-Control-Allow-Credentials: true 가 없어요.' });
  }
  return failures;
}

const CONSOLE_TEXT: Record<FailureCode, string> = {
  origin: "Reason: CORS header 'Access-Control-Allow-Origin' does not match 'https://shop.example'",
  'wildcard-credentials': "Reason: Credential is not supported if the CORS header 'Access-Control-Allow-Origin' is '*'",
  method: "Reason: Did not find method in CORS header 'Access-Control-Allow-Methods'",
  header: "Reason: missing token in CORS header 'Access-Control-Allow-Headers' from CORS preflight channel",
  'auth-header':
    "Reason: missing token 'Authorization' in CORS header 'Access-Control-Allow-Headers' from CORS preflight channel",
  'allow-credentials': "Reason: expected 'true' in CORS header 'Access-Control-Allow-Credentials'",
};

export function evaluate(input: Input): Result {
  const target = TARGETS.find((t) => t.id === input.target) ?? TARGETS[0];
  const origin = originOf(target.url);
  const cross = origin !== PAGE_ORIGIN;
  const reasons = preflightReasons(input);
  const preflightNeeded = reasons.length > 0;

  if (!cross) {
    const steps: Step[] = [
      {
        id: 'origin',
        title: '출처 비교',
        status: 'pass',
        detail: `${origin} 는 페이지와 같은 출처예요. CORS 검사를 하지 않아요. 아래 서버 응답 설정은 이 경우 영향이 없어요.`,
      },
      {
        id: 'need',
        title: '프리플라이트 필요 여부',
        status: 'skip',
        detail: '같은 출처 요청은 OPTIONS 를 보내지 않아요.',
      },
      { id: 'preflight', title: '프리플라이트 (OPTIONS)', status: 'skip', detail: '보내지 않아요.' },
      { id: 'request', title: '실제 요청', status: 'pass', detail: '요청이 서버에 도달하고 응답을 받아요.' },
      {
        id: 'read',
        title: 'JS 응답 읽기',
        status: 'pass',
        detail: '응답 본문과 모든 헤더를 읽을 수 있어요. Set-Cookie 는 예외예요.',
      },
    ];
    return {
      origin,
      cross,
      preflightReasons: [],
      preflightNeeded: false,
      optionsReached: false,
      preflightPassed: true,
      actualSent: true,
      readable: true,
      readableHeaders: [...SAFELISTED_RESPONSE_HEADERS, ...RESP_HEADERS],
      preflightFailures: [],
      readFailures: [],
      consoleHint: null,
      steps,
    };
  }

  const preflightFailures = preflightNeeded ? preflightCheck(input) : [];
  const preflightPassed = preflightFailures.length === 0;
  const actualSent = !preflightNeeded || preflightPassed;
  const readFailures = actualSent ? readCheck(input) : [];
  const readable = actualSent && readFailures.length === 0;
  const readableHeaders = readable
    ? [...SAFELISTED_RESPONSE_HEADERS, ...RESP_HEADERS.filter((h) => input.expose.includes(h))]
    : [];
  const firstFailure = preflightFailures[0] ?? readFailures[0];

  const steps: Step[] = [
    {
      id: 'origin',
      title: '출처 비교',
      status: 'info',
      detail: `${origin} 는 페이지(${PAGE_ORIGIN})와 다른 출처예요. 스킴 · 호스트 · 포트 중 하나가 달라요.`,
    },
    {
      id: 'need',
      title: '프리플라이트 필요 여부',
      status: preflightNeeded ? 'info' : 'skip',
      detail: preflightNeeded
        ? reasons.join(' ')
        : '안전 목록 안의 단순 요청이라 OPTIONS 를 보내지 않아요. 자격 증명만 바꿔도 프리플라이트는 생기지 않아요.',
    },
    preflightNeeded
      ? {
          id: 'preflight',
          title: '프리플라이트 (OPTIONS)',
          status: preflightPassed ? 'pass' : 'fail',
          detail: preflightPassed
            ? 'OPTIONS 응답이 요청 메서드와 헤더를 허락해요. 프리플라이트는 자격 증명 없이 나가요.'
            : `OPTIONS 는 서버에 도달했지만 허락을 받지 못했어요. ${preflightFailures.map((f) => f.text).join(' ')}`,
        }
      : { id: 'preflight', title: '프리플라이트 (OPTIONS)', status: 'skip', detail: '보내지 않아요.' },
    actualSent
      ? {
          id: 'request',
          title: '실제 요청',
          status: 'pass',
          detail: '요청이 서버에 도달해 처리돼요. CORS 헤더 설정과 관계없이 서버는 요청을 처리해요.',
        }
      : {
          id: 'request',
          title: '실제 요청',
          status: 'fail',
          detail: '실제 요청을 보내지 않아요. 서버는 OPTIONS 만 받았어요.',
        },
    !actualSent
      ? { id: 'read', title: 'JS 응답 읽기', status: 'skip', detail: '응답이 없어서 읽을 것도 없어요.' }
      : readable
        ? { id: 'read', title: 'JS 응답 읽기', status: 'pass', detail: 'JS 가 응답 본문을 읽을 수 있어요.' }
        : {
            id: 'read',
            title: 'JS 응답 읽기',
            status: 'fail',
            detail: `서버는 응답을 보냈지만 JS 는 읽을 수 없어요. ${readFailures.map((f) => f.text).join(' ')}`,
          },
    readable
      ? {
          id: 'headers',
          title: 'JS 에서 읽을 수 있는 헤더',
          status: 'info',
          detail: `${readableHeaders.join(', ')}. 기본으로 읽히는 헤더 밖은 Access-Control-Expose-Headers 에 적어야 해요.`,
        }
      : { id: 'headers', title: 'JS 에서 읽을 수 있는 헤더', status: 'skip', detail: '읽을 수 있는 헤더가 없어요.' },
  ];

  if (input.credentials === 'include') {
    steps.push({
      id: 'cookie',
      title: '쿠키 전송',
      status: 'info',
      detail: '쿠키는 CORS 와 별개로 SameSite 같은 쿠키 정책을 따라요. 이 판정은 쿠키 정책을 다루지 않아요.',
    });
  }

  if (preflightNeeded && preflightPassed) {
    steps.push({
      id: 'cache',
      title: '프리플라이트 캐시',
      status: 'info',
      detail:
        input.maxAge === null
          ? 'Access-Control-Max-Age 가 없어서 브라우저 기본값 5초 동안 같은 조건의 OPTIONS 결과를 재사용해요.'
          : `Access-Control-Max-Age ${input.maxAge}초 동안 같은 조건의 요청은 OPTIONS 를 다시 보내지 않을 수 있어요. 브라우저마다 상한이 있어 실제는 더 짧을 수 있어요.`,
    });
  }

  if (input.allowOrigin === 'echo' && !input.vary) {
    steps.push({
      id: 'vary',
      title: '공유 캐시',
      status: 'warn',
      detail:
        'Access-Control-Allow-Origin 이 요청 출처를 그대로 따라 가는데 Vary: Origin 이 없어요. 캐시가 출처마다 나눠 저장하지 않아서 다른 출처에 옛 응답을 줄 수 있어요.',
    });
  }

  return {
    origin,
    cross,
    preflightReasons: reasons,
    preflightNeeded,
    optionsReached: preflightNeeded,
    preflightPassed,
    actualSent,
    readable,
    readableHeaders,
    preflightFailures,
    readFailures,
    consoleHint: firstFailure ? CONSOLE_TEXT[firstFailure.code] : null,
    steps,
  };
}
