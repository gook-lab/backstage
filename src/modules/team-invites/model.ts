/** 초대 방식: 이메일 지정은 받을 사람을 정하고, 공유 링크는 받을 사람을 정하지 않아요 */
export type InviteKind = 'email' | 'link';
/** 초대에 기록되는 권한 */
export type Role = 'member' | 'admin';
/** 초대 상태. 조건부 UPDATE 로만 바뀌어요 */
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type Scenario = 'normal' | 'other-account' | 'leaked' | 'revoked' | 'expired' | 'concurrent' | 'demoted';

export interface InviteConfig {
  kind: InviteKind;
  /** 초대에 기록한 권한 */
  role: Role;
  scenario: Scenario;
  /** 수락할 때 만료 시각을 확인해요 */
  checkExpiry: boolean;
  /** 상태가 pending 일 때만 수락으로 바꿔요 (조건부 UPDATE). 끄면 같은 초대를 여러 번 받아요 */
  singleUse: boolean;
  /** 이메일 지정 초대에서 로그인 계정 이메일과 초대 대상 이메일을 비교해요 */
  checkEmail: boolean;
  /** 수락할 때 초대한 사람의 현재 권한으로 기록된 권한을 다시 확인해요 */
  revalidateRole: boolean;
  /** 취소할 때 초대 상태를 revoked 로 바꿔요. 끄면 취소 표시만 되고 링크는 살아 있어요 */
  revokeUpdatesStatus: boolean;
}

/** 시뮬레이터가 쓰는 가상의 계정. 실제 사람이 아니에요 */
export type Actor = 'target' | 'other' | 'stranger';

export interface MemberRow {
  email: string;
  role: Role;
  /** 이번 수락으로 새로 들어온 행인지 */
  origin: 'existing' | 'joined';
}

export interface RequestOutcome {
  actor: Actor;
  email: string;
  ok: boolean;
  message: string;
}

export interface InviteResult {
  outcomes: RequestOutcome[];
  status: InviteStatus;
  members: MemberRow[];
  /** 성공한 수락 요청 수. 같은 초대가 몇 번 쓰였는지 보여요 */
  acceptedCount: number;
  notes: string[];
}

export const EMAIL: Record<Actor, string> = {
  target: 'invitee@example.com',
  other: 'other@example.com',
  stranger: 'stranger@example.com',
};

const BASE_MEMBERS: { email: string; role: Role }[] = [
  { email: 'admin@example.com', role: 'admin' },
  { email: 'member@example.com', role: 'member' },
];

const RANK: Record<Role, number> = { member: 0, admin: 1 };

interface ScenarioSpec {
  label: string;
  /** 수락 요청을 보내는 계정을 순서대로 */
  actors: Actor[];
  revoked: boolean;
  expired: boolean;
  /** 초대한 사람의 권한이 member 로 줄어든 상태 */
  inviterDemoted: boolean;
}

export const SCENARIOS: Record<Scenario, ScenarioSpec> = {
  normal: { label: '정상 수락', actors: ['target'], revoked: false, expired: false, inviterDemoted: false },
  'other-account': {
    label: '다른 계정으로 수락',
    actors: ['other'],
    revoked: false,
    expired: false,
    inviterDemoted: false,
  },
  leaked: {
    label: '링크 유출 뒤 제3자 수락',
    actors: ['stranger', 'target'],
    revoked: false,
    expired: false,
    inviterDemoted: false,
  },
  revoked: { label: '취소 뒤 수락', actors: ['target'], revoked: true, expired: false, inviterDemoted: false },
  expired: { label: '만료 뒤 수락', actors: ['target'], revoked: false, expired: true, inviterDemoted: false },
  concurrent: {
    label: '동시 수락 두 번',
    actors: ['target', 'target'],
    revoked: false,
    expired: false,
    inviterDemoted: false,
  },
  demoted: {
    label: '초대자 권한 박탈 뒤 수락',
    actors: ['target'],
    revoked: false,
    expired: false,
    inviterDemoted: true,
  },
};

export const DEFAULT_CONFIG: InviteConfig = {
  kind: 'email',
  role: 'member',
  scenario: 'normal',
  checkExpiry: true,
  singleUse: true,
  checkEmail: true,
  revalidateRole: true,
  revokeUpdatesStatus: true,
};

/** 수락 요청 하나를 검사하고 결과를 돌려줘요. 검사 순서는 실제 서버의 조건 순서와 같아요 */
function attempt(
  cfg: InviteConfig,
  spec: ScenarioSpec,
  state: { status: InviteStatus; inviterRole: Role },
  actor: Actor,
): { ok: boolean; message: string; status: InviteStatus } {
  let { status } = state;
  if (status === 'revoked') return { ok: false, message: '초대가 취소돼서 수락할 수 없어요.', status };
  if (status === 'expired') return { ok: false, message: '초대 기간이 지나서 수락할 수 없어요.', status };

  if (spec.expired && cfg.checkExpiry) {
    return { ok: false, message: '초대 기간이 지나서 수락할 수 없어요.', status: 'expired' };
  }

  if (cfg.kind === 'email' && cfg.checkEmail && actor !== 'target') {
    return { ok: false, message: '초대받은 이메일과 로그인한 계정이 달라요.', status };
  }

  if (cfg.revalidateRole && RANK[state.inviterRole] < RANK[cfg.role]) {
    return {
      ok: false,
      message: '초대한 사람의 권한이 줄어서 이 권한으로는 들어갈 수 없어요.',
      status,
    };
  }

  if (cfg.singleUse && status === 'accepted') {
    return { ok: false, message: '이미 수락된 초대예요. 한 번만 쓸 수 있어요.', status };
  }

  status = 'accepted';
  if (cfg.kind === 'link' && actor !== 'target') {
    return { ok: true, message: '링크를 연 계정이 들어갔어요. 링크는 받을 사람을 확인하지 않아요.', status };
  }
  if (cfg.kind === 'email' && actor !== 'target') {
    return { ok: true, message: '초대받지 않은 계정이 들어갔어요. 이메일 일치 확인이 꺼져 있어요.', status };
  }
  return { ok: true, message: '초대받은 계정이 들어갔어요.', status };
}

/** 선택한 설정으로 수락 요청을 차례로 처리하고, 최종 상태와 멤버 목록을 돌려줘요 */
export function simulate(cfg: InviteConfig): InviteResult {
  const spec = SCENARIOS[cfg.scenario];
  let status: InviteStatus = 'pending';
  if (spec.revoked && cfg.revokeUpdatesStatus) status = 'revoked';
  const inviterRole: Role = spec.inviterDemoted ? 'member' : 'admin';

  const members: MemberRow[] = BASE_MEMBERS.map((m) => ({ ...m, origin: 'existing' }));
  const outcomes: RequestOutcome[] = [];

  for (const actor of spec.actors) {
    const email = EMAIL[actor];
    const r = attempt(cfg, spec, { status, inviterRole }, actor);
    status = r.status;
    let message = r.message;
    if (r.ok) {
      const existing = members.find((m) => m.email === email);
      if (existing) {
        message = '같은 계정이라 멤버 행은 그대로예요. 초대는 한 번 더 쓰였어요.';
      } else {
        members.push({ email, role: cfg.role, origin: 'joined' });
      }
    }
    outcomes.push({ actor, email, ok: r.ok, message });
  }

  const notes: string[] = [];
  if (spec.inviterDemoted && !cfg.revalidateRole && cfg.role === 'admin') {
    notes.push('초대한 사람은 이제 멤버인데, 초대에 적힌 관리자 권한으로 들어갔어요.');
  }
  if (spec.revoked && !cfg.revokeUpdatesStatus) {
    notes.push('취소 버튼을 눌렀지만 상태는 그대로예요. 이미 보낸 링크가 계속 통해요.');
  }

  return {
    outcomes,
    status,
    members,
    acceptedCount: outcomes.filter((o) => o.ok).length,
    notes,
  };
}
