import { DEFAULT_CONFIG, EMAIL, type InviteConfig, simulate } from './model';

const cfg = (patch: Partial<InviteConfig>): InviteConfig => ({ ...DEFAULT_CONFIG, ...patch });

const memberEmails = (c: InviteConfig) => simulate(c).members.map((m) => m.email);

describe('팀 초대 모델', () => {
  it('정상 수락하면 초대받은 계정이 기록된 권한으로 들어가고 상태가 accepted 가 돼요', () => {
    const r = simulate(DEFAULT_CONFIG);
    expect(r.outcomes).toHaveLength(1);
    expect(r.outcomes[0].ok).toBe(true);
    expect(r.status).toBe('accepted');
    expect(r.members.find((m) => m.email === EMAIL.target)).toEqual({
      email: EMAIL.target,
      role: 'member',
      origin: 'joined',
    });
    expect(r.members).toHaveLength(3);
  });

  it('이메일 지정 초대는 다른 계정으로 수락하면 거절되고 멤버 목록이 그대로예요', () => {
    const r = simulate(cfg({ scenario: 'other-account' }));
    expect(r.outcomes[0].ok).toBe(false);
    expect(r.outcomes[0].message).toBe('초대받은 이메일과 로그인한 계정이 달라요.');
    expect(r.status).toBe('pending');
    expect(memberEmails(cfg({ scenario: 'other-account' }))).not.toContain(EMAIL.other);
  });

  it('이메일 일치 확인을 끄면 다른 계정이 들어가요', () => {
    const c = cfg({ scenario: 'other-account', checkEmail: false });
    expect(simulate(c).members.map((m) => m.email)).toContain(EMAIL.other);
  });

  it('공유 링크는 로그인 계정을 확인하지 않아서 다른 계정이 들어가요', () => {
    const c = cfg({ kind: 'link', scenario: 'other-account' });
    const r = simulate(c);
    expect(r.outcomes[0].ok).toBe(true);
    expect(r.members.map((m) => m.email)).toContain(EMAIL.other);
  });

  it('이메일 지정 초대는 유출된 링크로 제3자가 들어와도 막고, 원래 받을 사람은 들어갈 수 있어요', () => {
    const r = simulate(cfg({ scenario: 'leaked' }));
    expect(r.outcomes.map((o) => o.ok)).toEqual([false, true]);
    expect(r.members.map((m) => m.email)).toContain(EMAIL.target);
    expect(r.members.map((m) => m.email)).not.toContain(EMAIL.stranger);
  });

  it('공유 링크가 유출되면 1회 사용이어도 먼저 연 제3자가 들어가고 원래 받을 사람은 막혀요', () => {
    const r = simulate(cfg({ kind: 'link', scenario: 'leaked', singleUse: true }));
    expect(r.outcomes.map((o) => o.ok)).toEqual([true, false]);
    expect(r.members.map((m) => m.email)).toContain(EMAIL.stranger);
    expect(r.members.map((m) => m.email)).not.toContain(EMAIL.target);
  });

  it('취소할 때 상태를 바꾸면 이미 보낸 링크도 즉시 거절돼요', () => {
    const r = simulate(cfg({ scenario: 'revoked', revokeUpdatesStatus: true }));
    expect(r.outcomes[0].ok).toBe(false);
    expect(r.outcomes[0].message).toBe('초대가 취소돼서 수락할 수 없어요.');
    expect(r.status).toBe('revoked');
  });

  it('취소할 때 상태를 바꾸지 않으면 링크가 계속 통하고 알림이 남아요', () => {
    const r = simulate(cfg({ scenario: 'revoked', revokeUpdatesStatus: false }));
    expect(r.outcomes[0].ok).toBe(true);
    expect(r.notes).toHaveLength(1);
  });

  it('만료를 확인하면 기간이 지난 뒤 수락이 거절되고 상태가 expired 가 돼요', () => {
    const r = simulate(cfg({ scenario: 'expired', checkExpiry: true }));
    expect(r.outcomes[0].ok).toBe(false);
    expect(r.status).toBe('expired');
  });

  it('만료를 확인하지 않으면 기간이 지난 초대도 수락돼요', () => {
    const r = simulate(cfg({ scenario: 'expired', checkExpiry: false }));
    expect(r.outcomes[0].ok).toBe(true);
    expect(r.status).toBe('accepted');
  });

  it('1회 사용이면 동시에 보낸 두 번째 수락이 거절되고 초대는 한 번만 쓰여요', () => {
    const r = simulate(cfg({ scenario: 'concurrent', singleUse: true }));
    expect(r.outcomes.map((o) => o.ok)).toEqual([true, false]);
    expect(r.acceptedCount).toBe(1);
    expect(r.members.filter((m) => m.email === EMAIL.target)).toHaveLength(1);
  });

  it('1회 사용을 끄면 같은 초대가 두 번 쓰여도 멤버 행은 하나로 남아요', () => {
    const r = simulate(cfg({ scenario: 'concurrent', singleUse: false }));
    expect(r.outcomes.map((o) => o.ok)).toEqual([true, true]);
    expect(r.acceptedCount).toBe(2);
    expect(r.members.filter((m) => m.email === EMAIL.target)).toHaveLength(1);
  });

  it('초대한 사람이 관리자 권한을 잃은 뒤 관리자 초대를 수락하면 권한 재검증이 거절해요', () => {
    const r = simulate(cfg({ scenario: 'demoted', role: 'admin', revalidateRole: true }));
    expect(r.outcomes[0].ok).toBe(false);
    expect(r.outcomes[0].message).toBe('초대한 사람의 권한이 줄어서 이 권한으로는 들어갈 수 없어요.');
  });

  it('재검증을 끄면 관리자 권한으로 들어가고, 메모가 권한 상승을 알려요', () => {
    const r = simulate(cfg({ scenario: 'demoted', role: 'admin', revalidateRole: false }));
    expect(r.outcomes[0].ok).toBe(true);
    expect(r.members.find((m) => m.email === EMAIL.target)?.role).toBe('admin');
    expect(r.notes[0]).toContain('관리자 권한으로 들어갔어요');
  });

  it('멤버 권한 초대는 초대한 사람이 멤버로 내려가도 재검증을 통과해요', () => {
    const r = simulate(cfg({ scenario: 'demoted', role: 'member', revalidateRole: true }));
    expect(r.outcomes[0].ok).toBe(true);
  });
});
