// 에러 응답 시뮬레이터 모델. 모든 함수는 순수해요. 같은 서버 응답이면 항상 같은 화면이 나와요.
// 서버는 같은 회원 가입 실패를 세 가지 모양으로 돌려줄 수 있어요. FE 파서는 응답을 한 함수에서 읽고 화면 상태를 만들어요.

/** 서버가 에러를 담는 방식 */
export type ResponseStyle = 'string-200' | 'text-400' | 'problem-json';

/** 서버 안에서 일어난 실패 하나 */
export type Scenario = 'fields' | 'duplicate' | 'overload' | 'internal';

export type FieldName = 'email' | 'password' | 'nickname';

export interface StyleOption {
  id: ResponseStyle;
  label: string;
  summary: string;
}

export interface ScenarioOption {
  id: Scenario;
  label: string;
}

export const STYLES: StyleOption[] = [
  {
    id: 'string-200',
    label: '200 + 에러 문자열',
    summary:
      '상태 코드는 200이고, 본문의 error 문자열 하나에 실패를 담아요. 어느 칸이 틀렸는지 문자열만으로는 알 수 없어요.',
  },
  {
    id: 'text-400',
    label: '텍스트 한 줄 (상태 코드만)',
    summary: '상태 코드가 실패를 알려 줘요. 본문은 "Bad Request" 같은 한 줄뿐이라 칸별 정보가 없어요.',
  },
  {
    id: 'problem-json',
    label: 'problem+json 필드 오류',
    summary: '상태 코드, type, 필드별 errors 배열을 담아요. 칸 위치는 pointer 로 알려 줘요.',
  },
];

export const SCENARIOS: ScenarioOption[] = [
  { id: 'fields', label: '입력값 3칸이 틀림' },
  { id: 'duplicate', label: '이미 가입된 이메일' },
  { id: 'overload', label: '서버가 바빠서 잠시 거절' },
  { id: 'internal', label: '서버 안에서 예기치 않은 오류' },
];

/** 입력 예시. 시뮬레이터 화면에 고정으로 보여 줘요 */
export const SAMPLE_INPUT: Record<FieldName, { label: string; value: string }> = {
  email: { label: '이메일', value: 'kim@' },
  password: { label: '비밀번호', value: '123' },
  nickname: { label: '닉네임', value: '' },
};

/** 서버 응답. body 는 방식마다 모양이 달라요 */
export interface ServerReply {
  status: number;
  /** Retry-After 헤더(초). 없으면 null */
  retryAfterSec: number | null;
  body: unknown;
}

export interface ProblemError {
  detail: string;
  pointer: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ProblemError[];
}

/** 예시 type URI. 실제 서비스에서는 이 주소에 문서를 두는 편이 좋아요 */
export const PROBLEM_TYPES = {
  invalidInput: 'https://example.com/problems/invalid-input',
  duplicateEmail: 'https://example.com/problems/duplicate-email',
  overloaded: 'https://example.com/problems/overloaded',
  internal: 'https://example.com/problems/internal',
} as const;

/** 같은 실패를 세 방식으로 돌려줄 때의 서버 응답 */
export function serverReply(style: ResponseStyle, scenario: Scenario): ServerReply {
  const requestId = 'req-7f3a2c';

  if (style === 'string-200') {
    const message: Record<Scenario, string> = {
      fields: '입력값을 확인해 주세요',
      duplicate: '이미 가입된 이메일이에요',
      overload: '잠시 후 다시 시도해 주세요',
      internal: '문제가 생겼어요',
    };
    return { status: 200, retryAfterSec: null, body: { error: message[scenario] } };
  }

  if (style === 'text-400') {
    const line: Record<Scenario, { status: number; text: string; retry: number | null }> = {
      fields: { status: 400, text: 'Bad Request', retry: null },
      duplicate: { status: 409, text: 'Conflict', retry: null },
      overload: { status: 503, text: 'Service Unavailable', retry: 30 },
      internal: { status: 500, text: 'Internal Server Error', retry: null },
    };
    const v = line[scenario];
    return { status: v.status, retryAfterSec: v.retry, body: v.text };
  }

  const problems: Record<Scenario, { status: number; problem: Problem; retry: number | null }> = {
    fields: {
      status: 422,
      retry: null,
      problem: {
        type: PROBLEM_TYPES.invalidInput,
        title: '입력값을 확인해 주세요',
        status: 422,
        errors: [
          { detail: '올바른 이메일 형식이 아니에요', pointer: '#/email' },
          { detail: '8자 이상이어야 해요', pointer: '#/password' },
          { detail: '닉네임을 입력해 주세요', pointer: '#/nickname' },
        ],
      },
    },
    duplicate: {
      status: 409,
      retry: null,
      problem: {
        type: PROBLEM_TYPES.duplicateEmail,
        title: '이미 가입된 이메일이에요',
        status: 409,
        errors: [{ detail: '이 이메일은 이미 사용 중이에요', pointer: '#/email' }],
      },
    },
    overload: {
      status: 503,
      retry: 30,
      problem: {
        type: PROBLEM_TYPES.overloaded,
        title: '서버가 잠시 바빠요',
        status: 503,
        detail: '요청이 몰려 잠시 거절했어요.',
        instance: `/requests/${requestId}`,
      },
    },
    internal: {
      status: 500,
      retry: null,
      problem: {
        type: PROBLEM_TYPES.internal,
        title: '문제가 생겼어요',
        status: 500,
        // 스택이나 SQL 은 응답에 넣지 않고 서버 로그에만 남겨요
        detail: '요청을 처리하지 못했어요.',
        instance: `/requests/${requestId}`,
      },
    },
  };
  const v = problems[scenario];
  return { status: v.status, retryAfterSec: v.retry, body: v.problem };
}

export interface Screen {
  /** 입력칸 옆에 붙는 오류 */
  fieldErrors: { field: FieldName; message: string }[];
  /** 화면 상단 전역 메시지 */
  banner: string | null;
  /** 재시도 버튼이 보이는지 */
  retryButton: boolean;
  /** 문의용 요청 번호. 없으면 null */
  requestId: string | null;
  /** 화면 결과를 한 문장으로 */
  summary: string;
}

/** 상태 코드만 보고 정하는 일반 메시지. 본문을 읽지 못할 때 쓰는 마지막 안전망이에요 */
const FALLBACK_BY_STATUS: Record<number, string> = {
  400: '입력을 확인해 주세요',
  409: '요청이 현재 상태와 충돌해요',
  422: '입력을 확인해 주세요',
  500: '문제가 생겼어요. 잠시 후 다시 시도해 주세요',
  503: '서버가 잠시 바빠요',
};

const FIELD_OF_POINTER: Record<string, FieldName> = {
  '#/email': 'email',
  '#/password': 'password',
  '#/nickname': 'nickname',
};

/** 알고 있는 type 의 사용자 메시지. 모르는 type 은 상태 코드 기준 일반 메시지로 가요 */
const MESSAGE_BY_TYPE: Record<string, string> = {
  [PROBLEM_TYPES.invalidInput]: '입력값을 확인해 주세요',
  [PROBLEM_TYPES.overloaded]: '서버가 잠시 바빠요',
  [PROBLEM_TYPES.internal]: '문제가 생겼어요',
};

const isProblem = (body: unknown): body is Problem =>
  typeof body === 'object' && body !== null && 'type' in body && 'status' in body;

/** FE 응답 파서 하나. 응답 모양에 따라 화면 상태를 정해요 */
export function parseReply(reply: ServerReply): Screen {
  const { status, retryAfterSec, body } = reply;
  // 재시도는 상태 코드와 Retry-After 헤더로만 판단해요. 200 에는 재시도 신호가 없어요
  const retryButton = (status === 503 || status === 429) && retryAfterSec !== null;

  if (status === 200 && typeof body === 'object' && body !== null && 'error' in body) {
    const error = String((body as { error: unknown }).error);
    return {
      fieldErrors: [],
      banner: error,
      retryButton: false,
      requestId: null,
      summary: '상태 코드가 200이라 실패를 알 수 없어요. 본문의 error 문자열만 상단에 보여 줬어요.',
    };
  }

  if (!isProblem(body)) {
    const fallback = FALLBACK_BY_STATUS[status] ?? '문제가 생겼어요';
    return {
      fieldErrors: [],
      banner: fallback,
      retryButton,
      requestId: null,
      summary: `본문이 한 줄뿐이라 칸별 오류가 없어요. 상태 ${status} 기준 일반 메시지로 바꿨어요.`,
    };
  }

  const fieldErrors = (body.errors ?? []).flatMap((e) => {
    const field = FIELD_OF_POINTER[e.pointer];
    return field ? [{ field, message: e.detail }] : [];
  });
  const known = MESSAGE_BY_TYPE[body.type];
  // 입력 오류는 상단 문구와 칸 옆 오류를 함께 보여 줘요. 칸을 특정한 다른 오류는 칸 옆에만 붙여요
  const banner =
    body.type === PROBLEM_TYPES.invalidInput
      ? known
      : fieldErrors.length > 0
        ? null
        : (known ?? FALLBACK_BY_STATUS[status] ?? '문제가 생겼어요');
  const requestId = body.instance ? body.instance.replace('/requests/', '') : null;

  return {
    fieldErrors,
    banner,
    retryButton,
    requestId,
    summary:
      fieldErrors.length > 0
        ? `pointer로 칸을 찾아 입력칸 ${fieldErrors.length}곳 옆에 오류를 붙였어요.`
        : `type으로 메시지를 골랐어요. 알 수 없는 type 이면 상태 ${status} 기준 일반 메시지를 써요.`,
  };
}

/** 선택한 방식과 실패로 화면을 만들어요 */
export function screenFor(style: ResponseStyle, scenario: Scenario): Screen {
  return parseReply(serverReply(style, scenario));
}
