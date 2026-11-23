import { type AccountConfig, evaluate } from './model';

const DEFAULT: AccountConfig = {
  scenario: 'takeover',
  reauth: false,
  pending: false,
  notifyOld: false,
  revokeOthers: false,
  uniqueAtConfirm: false,
};

const withCfg = (patch: Partial<AccountConfig>): AccountConfig => ({ ...DEFAULT, ...patch });

describe('계정 변경 모델 — 세션 탈취', () => {
  it('기본값은 재인증 없이 바로 바뀌어서 공격자가 계정을 가져가고 되돌릴 수 없어요', () => {
    const r = evaluate(DEFAULT);
    expect(r.attackerAccess).toBe(true);
    expect(r.reversible).toBe(false);
    expect(r.lockedOut).toBe(true);
    expect(r.loginAddress).toBe('attacker');
  });

  it('현재 비밀번호를 확인하면 세션만 가진 공격자는 변경 요청에서 막혀요', () => {
    const r = evaluate(withCfg({ reauth: true }));
    expect(r.attackerAccess).toBe(false);
    expect(r.loginAddress).toBe('old');
    expect(r.lockedOut).toBe(false);
  });

  it('대기 상태만 켜면 공격자가 새 주소의 확인 링크를 눌러서 여전히 계정을 가져가요', () => {
    const r = evaluate(withCfg({ pending: true }));
    expect(r.attackerAccess).toBe(true);
  });

  it('옛 주소 알림을 켜면 탈취 뒤에도 되돌리기가 가능해요', () => {
    const r = evaluate(withCfg({ notifyOld: true }));
    expect(r.attackerAccess).toBe(true);
    expect(r.reversible).toBe(true);
    expect(r.lockedOut).toBe(false);
  });

  it('다른 세션을 끊어도 바꾼 공격자 세션은 남아서 탈취는 그대로예요', () => {
    const r = evaluate(withCfg({ revokeOthers: true }));
    expect(r.attackerAccess).toBe(true);
    expect(r.sessionsLeft).toBe(1);
  });
});

describe('계정 변경 모델 — 오타 난 새 이메일', () => {
  it('대기 상태면 로그인 주소가 그대로여서 잠기지 않고 취소할 수 있어요', () => {
    const r = evaluate(withCfg({ scenario: 'typo', pending: true }));
    expect(r.loginAddress).toBe('old');
    expect(r.lockedOut).toBe(false);
    expect(r.reversible).toBe(true);
  });

  it('바로 적용하고 알림도 없으면 다음 로그인부터 잠겨요', () => {
    const r = evaluate(withCfg({ scenario: 'typo' }));
    expect(r.loginAddress).toBe('typo');
    expect(r.lockedOut).toBe(true);
    expect(r.reversible).toBe(false);
  });

  it('바로 적용해도 옛 주소 알림이 있으면 되돌릴 수 있어요', () => {
    const r = evaluate(withCfg({ scenario: 'typo', notifyOld: true }));
    expect(r.lockedOut).toBe(false);
    expect(r.reversible).toBe(true);
  });
});

describe('계정 변경 모델 — 다른 기기 세션', () => {
  it('비밀번호를 바꾸고 다른 세션을 끊지 않으면 공격자 세션 4개가 그대로 살아 있어요', () => {
    const r = evaluate(withCfg({ scenario: 'otherDevice' }));
    expect(r.attackerAccess).toBe(true);
    expect(r.sessionsLeft).toBe(4);
  });

  it('다른 세션을 끊으면 현재 기기 하나만 남고 공격자 접근이 끊겨요', () => {
    const r = evaluate(withCfg({ scenario: 'otherDevice', revokeOthers: true }));
    expect(r.attackerAccess).toBe(false);
    expect(r.sessionsLeft).toBe(1);
  });
});

describe('계정 변경 모델 — 같은 새 이메일 동시 요청', () => {
  it('요청 때 미리 검사하면 응답으로 주소 사용 여부가 드러나요', () => {
    const r = evaluate(withCfg({ scenario: 'collision', uniqueAtConfirm: false }));
    expect(r.exposure).toBe(true);
  });

  it('확정 때만 검사하면 응답에 주소 사용 여부가 드러나지 않아요', () => {
    const r = evaluate(withCfg({ scenario: 'collision', uniqueAtConfirm: true }));
    expect(r.exposure).toBe(false);
    expect(r.loginAddress).toBeNull();
  });
});
