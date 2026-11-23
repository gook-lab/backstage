// API 계약 시뮬레이터 모델. 모든 함수는 순수해요. 같은 응답 텍스트와 같은 처리 방식이면 항상 같은 화면이 나와요.
// 서버 응답은 JSON 텍스트로 와요. FE 는 그 텍스트를 세 방식 중 하나로 읽고 화면 결과를 만들어요.

export type Scenario = 'ok' | 'rename' | 'type' | 'missing' | 'null' | 'enum' | 'extra' | 'big-id';
export type Strategy = 'assert' | 'parse' | 'parse-fallback';
export type Role = 'admin' | 'member';

/** 어디서 오류가 드러났는지. 컴파일 단계는 서버 응답을 보지 않아서 이 모델에 없어요 */
export type Detect = 'none' | 'boundary' | 'deep' | 'silent' | 'handled';

export interface User {
  id: number;
  name: string;
  email: string;
  nickname: string | null;
  role: Role;
  createdAt: string;
}

export interface Option<T extends string> {
  id: T;
  label: string;
  summary: string;
}

export const SCENARIOS: Option<Scenario>[] = [
  {
    id: 'ok',
    label: '계약과 같은 응답',
    summary: '명세와 모든 칸이 맞아요. 기준이 되는 응답이에요.',
  },
  {
    id: 'rename',
    label: '이름 필드가 바뀜',
    summary: 'name 이 fullName 으로 바뀌었어요. 응답에는 name 이 없어요.',
  },
  {
    id: 'type',
    label: '번호 타입이 바뀜',
    summary: 'id 가 숫자 42 에서 문자열 "42" 로 바뀌었어요.',
  },
  {
    id: 'missing',
    label: '닉네임 칸이 빠짐',
    summary: 'nickname 키 자체가 응답에서 없어졌어요. 값이 null 인 것과 달라요.',
  },
  {
    id: 'null',
    label: '닉네임이 null',
    summary: 'nickname 이 null 이에요. 명세가 null 을 허용하므로 계약을 어긴 응답은 아니에요.',
  },
  {
    id: 'enum',
    label: '새 권한 값 owner',
    summary: 'role 에 명세에 없던 owner 가 왔어요.',
  },
  {
    id: 'extra',
    label: '필드가 추가됨',
    summary: 'badge 필드가 새로 생겼어요. 명세에 없지만 소비자가 무시해도 되는 변경이에요.',
  },
  {
    id: 'big-id',
    label: '아주 큰 번호',
    summary: 'id 가 9007199254740993 이에요. 자바스크립트 숫자가 정확히 담는 범위를 넘어요.',
  },
];

export const STRATEGIES: Option<Strategy>[] = [
  {
    id: 'assert',
    label: '타입 단언만 (as User)',
    summary: 'JSON 결과에 as User 만 붙여요. 실행 중에는 응답을 아무것도 검사하지 않아요.',
  },
  {
    id: 'parse',
    label: '경계 파싱',
    summary: '응답을 unknown 으로 받고 칸마다 검사해요. 하나라도 어긋나면 화면에 들어가기 전에 멈춰요.',
  },
  {
    id: 'parse-fallback',
    label: '파싱 + 모르는 권한 대체',
    summary: '경계 파싱과 같지만, 모르는 role 값만 일반 회원으로 바꿔 보여 줘요. 다른 칸 오류는 그대로 멈춰요.',
  },
];

/** 계약 명세의 일부. JSON Schema 형식으로 적었어요. 시뮬레이터는 이 규칙을 checkUser 에서 직접 검사해요 */
export const SPEC_JSON = `{
  "type": "object",
  "required": ["id", "name", "email", "nickname", "role", "createdAt"],
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "nickname": { "type": ["string", "null"] },
    "role": { "enum": ["admin", "member"] },
    "createdAt": { "type": "string", "description": "RFC 3339 날짜 시간" }
  }
}`;

export const COMPILE_NOTE =
  '컴파일 단계: 서버 응답은 컴파일러가 보지 않아요. 그래서 이 표의 어떤 조합도 컴파일에서 드러나지 않아요. 명세를 고쳐 타입을 다시 만든 뒤에야 사용처에서 컴파일 오류가 나요.';

const BASE: User = {
  id: 42,
  name: '김단비',
  email: 'danbi@example.com',
  nickname: 'danbi',
  role: 'member',
  createdAt: '2026-11-24T09:00:00Z',
};

const ROLE_LABEL: Record<Role, string> = {
  admin: '관리자',
  member: '일반 회원',
};

const ROLES: Role[] = ['admin', 'member'];

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** 서버가 보낸 응답 본문(JSON 텍스트). 시나리오마다 다른 모양이에요 */
export function serverBody(scenario: Scenario): string {
  const body: Record<string, unknown> = { ...BASE };
  switch (scenario) {
    case 'rename':
      delete body.name;
      body.fullName = BASE.name;
      break;
    case 'type':
      body.id = '42';
      break;
    case 'missing':
      delete body.nickname;
      break;
    case 'null':
      body.nickname = null;
      break;
    case 'enum':
      body.role = 'owner';
      break;
    case 'extra':
      body.badge = 'beta';
      break;
    default:
      break;
  }
  const text = JSON.stringify(body);
  // 큰 정수는 텍스트 그대로 보내야 JSON.parse 가 정밀도를 잃는 모습을 보여 줄 수 있어요
  return scenario === 'big-id' ? text.replace('"id":42', '"id":9007199254740993') : text;
}

export interface Row {
  label: string;
  value: string;
}

/** 화면이 칸을 그리는 코드. User 타입을 믿고 쓰는 것을 가정해요 */
export function viewOf(user: User): Row[] {
  return [
    { label: '번호', value: String(user.id) },
    { label: '이름', value: user.name.trim() },
    { label: '닉네임', value: user.nickname === null ? '닉네임 없음' : `@${user.nickname}` },
    { label: '권한', value: String(ROLE_LABEL[user.role]) },
    { label: '다음 번호', value: String(user.id + 1) },
  ];
}

export interface Issue {
  path: string;
  message: string;
}

export interface Checked {
  user: User | null;
  issues: Issue[];
  notes: string[];
}

const hasKey = (o: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/**
 * 응답 값을 계약과 비교해요. 어긋난 칸은 issues 에 모으고, 허용 범위의 대체는 notes 에 남겨요.
 * fallbackRole 이 true 면 명세에 없는 role 값만 일반 회원으로 바꿔요.
 */
export function checkUser(raw: unknown, fallbackRole: boolean): Checked {
  const issues: Issue[] = [];
  const notes: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { user: null, issues: [{ path: '(루트)', message: '객체가 아니에요' }], notes };
  }
  const o = raw as Record<string, unknown>;

  // 키가 없는 것(undefined)과 null 은 다른 값이에요. 키 존재 여부를 따로 봐요
  const requireKey = (key: string) => {
    if (!hasKey(o, key)) {
      issues.push({ path: key, message: '칸이 없어요. 값이 없는 것과 null 은 달라요' });
      return false;
    }
    return true;
  };

  let idOk = false;
  if (requireKey('id')) {
    const v = o.id;
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      issues.push({ path: 'id', message: `정수여야 해요 (받은 값 ${JSON.stringify(v)})` });
    } else if (!Number.isSafeInteger(v)) {
      issues.push({ path: 'id', message: `안전한 정수 범위를 넘어 정확하지 않아요 (받은 값 ${v})` });
    } else {
      idOk = true;
    }
  }

  let nameOk = false;
  if (requireKey('name')) {
    if (typeof o.name === 'string') nameOk = true;
    else issues.push({ path: 'name', message: '문자열이어야 해요' });
  }

  let emailOk = false;
  if (requireKey('email')) {
    if (typeof o.email === 'string') emailOk = true;
    else issues.push({ path: 'email', message: '문자열이어야 해요' });
  }

  let nicknameOk = false;
  if (requireKey('nickname')) {
    if (o.nickname === null || typeof o.nickname === 'string') nicknameOk = true;
    else issues.push({ path: 'nickname', message: '문자열이나 null 이어야 해요' });
  }

  let role: Role | null = null;
  if (requireKey('role')) {
    const v = o.role;
    if (typeof v !== 'string') {
      issues.push({ path: 'role', message: '문자열이어야 해요' });
    } else if ((ROLES as string[]).includes(v)) {
      role = v as Role;
    } else if (fallbackRole) {
      role = 'member';
      notes.push(`모르는 권한 ${v} 은 일반 회원으로 보여 줘요`);
    } else {
      issues.push({ path: 'role', message: `명세에 없는 값이에요 (받은 값 ${JSON.stringify(v)})` });
    }
  }

  let dateOk = false;
  if (requireKey('createdAt')) {
    if (typeof o.createdAt === 'string' && RFC3339.test(o.createdAt)) dateOk = true;
    else issues.push({ path: 'createdAt', message: 'RFC 3339 날짜 시간 형식이 아니에요' });
  }

  if (issues.length > 0 || !idOk || !nameOk || !emailOk || !nicknameOk || role === null || !dateOk) {
    return { user: null, issues, notes };
  }

  const user: User = {
    id: o.id as number,
    name: o.name as string,
    email: o.email as string,
    nickname: o.nickname as string | null,
    role,
    createdAt: o.createdAt as string,
  };
  return { user, issues, notes };
}

export interface Screen {
  detect: Detect;
  /** 화면에 그려진 칸. 경계에서 멈추면 비어 있어요 */
  rows: Row[];
  /** 경계 파싱이 찾은 계약 위반 */
  issues: Issue[];
  /** 대체 처리로 바꾼 내용 */
  notes: string[];
  /** 화면 깊은 곳에서 난 예외 메시지 */
  crash: string | null;
  summary: string;
}

const SUMMARY: Record<Detect, string> = {
  none: '응답과 화면이 맞아요.',
  boundary: '응답을 받은 자리에서 계약 위반을 찾아 화면에 들어가기 전에 멈췄어요.',
  deep: '화면을 그리는 도중 예외가 났어요. 원인은 응답의 칸인데, 터진 곳은 화면 깊은 곳이에요.',
  silent: '에러는 없지만 화면에 틀린 값이 나와요. 아무도 알아채지 못하는 실패예요.',
  handled: '모르는 값을 명세 안의 기본값으로 바꿔 보여 줬어요. 바꾼 내용은 notes 에 남겨요.',
};

/** 응답이 실제로 뜻하는 화면. 자리 표시 값(undefined 같은)이 아니라 사람이 봐야 할 값이에요 */
const BASE_ROWS: Row[] = [
  { label: '번호', value: '42' },
  { label: '이름', value: '김단비' },
  { label: '닉네임', value: '@danbi' },
  { label: '권한', value: '일반 회원' },
  { label: '다음 번호', value: '43' },
];

export function expectedRows(scenario: Scenario): Row[] {
  const rows = BASE_ROWS.map((r) => ({ ...r }));
  const set = (label: string, value: string) => {
    const row = rows.find((r) => r.label === label);
    if (row) row.value = value;
  };
  if (scenario === 'missing' || scenario === 'null') set('닉네임', '닉네임 없음');
  if (scenario === 'enum') set('권한', 'owner');
  if (scenario === 'big-id') {
    set('번호', '9007199254740993');
    set('다음 번호', '9007199254740994');
  }
  return rows;
}

function assertScreen(scenario: Scenario): Screen {
  const raw = JSON.parse(serverBody(scenario)) as User;
  let rows: Row[];
  try {
    rows = viewOf(raw);
  } catch (e) {
    const crash = e instanceof Error ? e.message : String(e);
    return { detect: 'deep', rows: [], issues: [], notes: [], crash, summary: SUMMARY.deep };
  }
  const detect: Detect = JSON.stringify(rows) === JSON.stringify(expectedRows(scenario)) ? 'none' : 'silent';
  return { detect, rows, issues: [], notes: [], crash: null, summary: SUMMARY[detect] };
}

function parseScreen(scenario: Scenario, fallbackRole: boolean): Screen {
  const { user, issues, notes } = checkUser(JSON.parse(serverBody(scenario)), fallbackRole);
  if (!user) {
    const summary = `응답을 받은 자리에서 계약 위반 ${issues.length}건을 찾아 화면에 들어가기 전에 멈췄어요.`;
    return { detect: 'boundary', rows: [], issues, notes, crash: null, summary };
  }
  const rows = viewOf(user);
  const detect: Detect = notes.length > 0 ? 'handled' : 'none';
  return { detect, rows, issues, notes, crash: null, summary: SUMMARY[detect] };
}

/** 같은 응답을 고른 처리 방식으로 읽었을 때의 화면 결과 */
export function screenFor(strategy: Strategy, scenario: Scenario): Screen {
  if (strategy === 'assert') return assertScreen(scenario);
  return parseScreen(scenario, strategy === 'parse-fallback');
}

export const DETECT_LABEL: Record<Detect, string> = {
  none: '문제 없음',
  boundary: '경계에서 멈춤',
  deep: '화면 깊은 곳',
  silent: '안 드러남',
  handled: '경계에서 대체',
};
