// 계정 핵심 정보(이메일 · 비밀번호) 변경 모델. 모든 함수는 순수해요. 같은 입력이면 항상 같은 결과가 나와요.
// 단순화한 모델이에요. 사용자 세션 3개(현재 기기 포함)와 공격자가 예전에 얻은 세션 1개를 기본으로 둬요.
// 확인 링크는 새 주소를 가진 사람만 누를 수 있다고 가정해요.

/** 사용자 세션 수. 현재 기기를 포함해요 */
export const USER_SESSIONS = 3;
/** 공격자가 가진 세션 수 */
export const ATTACKER_SESSIONS = 1;
export const TOTAL_SESSIONS = USER_SESSIONS + ATTACKER_SESSIONS;

export type Scenario = 'takeover' | 'typo' | 'otherDevice' | 'collision';

export interface AccountConfig {
  scenario: Scenario;
  /** 민감한 변경 전에 현재 비밀번호를 다시 받아요 */
  reauth: boolean;
  /** 새 주소는 확인 링크를 누르기 전까지 대기 상태로 둬요 */
  pending: boolean;
  /** 옛 주소로 변경 알림을 보내고 되돌리기 링크를 붙여요 */
  notifyOld: boolean;
  /** 비밀번호 · 이메일 변경 뒤 바꾼 세션을 뺀 나머지 세션을 무효화해요 */
  revokeOthers: boolean;
  /** 요청 응답에서 미리 검사하지 않고 확정 시점에만 봐요 */
  uniqueAtConfirm: boolean;
}

export type LoginAddress = 'old' | 'attacker' | 'typo';

export interface AccountResult {
  /** 공격자가 아직 계정에 접근할 수 있는지 */
  attackerAccess: boolean;
  /** 사용자가 원래 상태로 되돌릴 수 있는지. null 이면 해당 없어요 */
  reversible: boolean | null;
  /** 변경이 끝난 뒤 남은 세션 수. null 이면 해당 없어요 */
  sessionsLeft: number | null;
  /** 요청 응답으로 주소 사용 여부가 드러나는지. null 이면 해당 없어요 */
  exposure: boolean | null;
  /** 다음 로그인에 쓰는 주소. null 이면 해당 없어요 */
  loginAddress: LoginAddress | null;
  /** 로그인 주소를 잃어 옛 상태로 돌아갈 수 없는지 */
  lockedOut: boolean;
}

export function evaluate(cfg: AccountConfig): AccountResult {
  switch (cfg.scenario) {
    case 'takeover': {
      // 세션을 훔친 공격자가 이메일을 바꿔요
      if (cfg.reauth) {
        // 현재 비밀번호를 모르는 공격자는 변경 요청에서 막혀요
        return {
          attackerAccess: false,
          reversible: null,
          sessionsLeft: TOTAL_SESSIONS,
          exposure: null,
          loginAddress: 'old',
          lockedOut: false,
        };
      }
      // 공격자는 자기 주소를 넣고 확인 링크도 직접 눌러요. 대기 상태는 이 경로를 막지 못해요
      return {
        attackerAccess: true,
        reversible: cfg.notifyOld,
        // 바꾼 공격자 세션은 남겨 두고, 사용자의 다른 세션을 끊어요
        sessionsLeft: cfg.revokeOthers ? ATTACKER_SESSIONS : TOTAL_SESSIONS,
        exposure: null,
        loginAddress: 'attacker',
        lockedOut: !cfg.notifyOld,
      };
    }

    case 'typo': {
      // 사용자가 새 이메일을 잘못 입력해요. 공격자는 없어요
      if (cfg.pending) {
        // 확인 메일은 오타 주소로 가서 아무도 누르지 않아요. 로그인 주소는 그대로예요
        return {
          attackerAccess: false,
          reversible: true,
          sessionsLeft: USER_SESSIONS,
          exposure: null,
          loginAddress: 'old',
          lockedOut: false,
        };
      }
      // 바로 적용되면 다음 로그인부터 오타 주소를 써요
      return {
        attackerAccess: false,
        reversible: cfg.notifyOld,
        sessionsLeft: cfg.revokeOthers ? 1 : USER_SESSIONS,
        exposure: null,
        loginAddress: 'typo',
        lockedOut: !cfg.notifyOld,
      };
    }

    case 'otherDevice': {
      // 사용자가 비밀번호를 바꿔요. 공격자는 예전에 얻은 세션 하나를 가지고 있어요
      return {
        attackerAccess: !cfg.revokeOthers,
        reversible: null,
        sessionsLeft: cfg.revokeOthers ? 1 : TOTAL_SESSIONS,
        exposure: null,
        loginAddress: 'old',
        lockedOut: false,
      };
    }

    case 'collision': {
      // 두 계정이 같은 새 이메일을 동시에 요청해요. 확정은 한 계정만 할 수 있어요
      return {
        attackerAccess: false,
        reversible: null,
        sessionsLeft: null,
        exposure: !cfg.uniqueAtConfirm,
        loginAddress: null,
        lockedOut: false,
      };
    }
  }
}
