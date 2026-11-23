/** 서버 검사 전략. 화면 숨김만 · 역할 검사만 · 역할 + 소유자 검사 */
export type Strategy = 'ui-only' | 'role-only' | 'role-and-owner';
export type Role = 'member' | 'admin';
export type Org = 'A' | 'B';
/** 주문 주인: 본인, 같은 조직 동료, 다른 조직 고객 */
export type Owner = 'self' | 'colleague' | 'outsider';
export type Action = 'read' | 'update' | 'export';
export type StatusCode = 200 | 401 | 403 | 404;
/** 어떤 검사에서 막혔는지. none 은 통과했다는 뜻 */
export type Denial = 'none' | 'auth' | 'role' | 'object';

export interface Scenario {
  readonly authenticated: boolean;
  readonly role: Role;
  readonly org: Org;
  readonly owner: Owner;
  readonly action: Action;
  readonly strategy: Strategy;
  /** 주문 주인이 아니어서 막힐 때 403 대신 404로 답해 존재를 숨겨요 */
  readonly hide404: boolean;
}

export interface Outcome {
  readonly status: StatusCode;
  /** 응답 본문에 주문 내용이 담기는지 */
  readonly exposed: boolean;
  readonly denial: Denial;
  readonly reason: string;
}

export const DEFAULT_SCENARIO: Scenario = {
  authenticated: true,
  role: 'member',
  org: 'A',
  owner: 'colleague',
  action: 'read',
  strategy: 'role-and-owner',
  hide404: false,
};

const other = (org: Org): Org => (org === 'A' ? 'B' : 'A');

export function ownerOrgOf(s: Scenario): Org {
  return s.owner === 'outsider' ? other(s.org) : s.org;
}

const allow = (reason: string): Outcome => ({ status: 200, exposed: true, denial: 'none', reason });

/**
 * 서버 응답을 흉내 낸다. 인증(401)은 세 전략 모두 되어 있다고 가정해요.
 * 시험 목적이라 실제 서비스의 정책과 다를 수 있어요.
 */
export function decide(s: Scenario): Outcome {
  if (!s.authenticated) {
    return {
      status: 401,
      exposed: false,
      denial: 'auth',
      reason: '로그인 정보가 없어서 인증 단계에서 막혀요. 인가 검사까지 가지 않아요.',
    };
  }

  if (s.strategy === 'ui-only') {
    return allow('서버는 버튼이 보이는지 보지 않아요. 요청이 그대로 처리돼서 주문 내용이 나가요.');
  }

  const sameOrg = ownerOrgOf(s) === s.org;
  const isAdmin = s.role === 'admin';

  if (s.strategy === 'role-only') {
    if (s.action === 'export') {
      if (!isAdmin) return deny('role', false, '관리자 역할이 없어서 막혀요.');
      if (!sameOrg) return allow('관리자 역할만 확인해요. 다른 조직 주문까지 내보내져요.');
      return allow('관리자 역할이 맞아서 통과해요.');
    }
    return allow('역할만 확인해요. 주문 주인이 누구인지 보지 않아서 남의 주문도 나가요.');
  }

  // role-and-owner: 역할로 동작을 가리고, 대상마다 주인 · 조직을 확인해요
  if (s.action === 'export') {
    if (!isAdmin) return deny('role', false, '관리자 역할이 없어서 막혀요.');
    if (!sameOrg) return deny('object', s.hide404, '다른 조직의 주문은 내보낼 수 없어요.');
    return allow('관리자이고 같은 조직이라 통과해요.');
  }

  const ownsIt = s.owner === 'self';
  if (ownsIt || (isAdmin && sameOrg)) {
    return allow(ownsIt ? '본인 주문이라 통과해요.' : '같은 조직 관리자라서 통과해요.');
  }
  return deny('object', s.hide404, '주문 주인도 아니고 같은 조직 관리자도 아니라서 막혀요.');
}

function deny(denial: 'role' | 'object', hide404: boolean, reason: string): Outcome {
  if (denial === 'role') return { status: 403, exposed: false, denial, reason };
  if (hide404) {
    return {
      status: 404,
      exposed: false,
      denial,
      reason: `${reason} 404로 답해서 주문이 있는지도 알려 주지 않아요.`,
    };
  }
  return { status: 403, exposed: false, denial, reason };
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly scenario: Scenario;
  readonly expected: StatusCode;
  readonly exposed: boolean;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'hidden-menu',
    label: '화면에서만 숨긴 주문 내보내기',
    scenario: { ...DEFAULT_SCENARIO, role: 'member', owner: 'outsider', action: 'export', strategy: 'ui-only' },
    expected: 200,
    exposed: true,
  },
  {
    id: 'id-swap',
    label: 'URL의 주문 id만 바꾸기',
    scenario: { ...DEFAULT_SCENARIO, role: 'member', owner: 'colleague', action: 'read', strategy: 'role-only' },
    expected: 200,
    exposed: true,
  },
  {
    id: 'other-org-admin',
    label: '다른 조직 관리자가 내보내기',
    scenario: { ...DEFAULT_SCENARIO, role: 'admin', owner: 'outsider', action: 'export', strategy: 'role-only' },
    expected: 200,
    exposed: true,
  },
  {
    id: 'owner-check',
    label: '역할과 소유자를 함께 검사',
    scenario: { ...DEFAULT_SCENARIO, role: 'member', owner: 'colleague', action: 'read', strategy: 'role-and-owner' },
    expected: 403,
    exposed: false,
  },
];
