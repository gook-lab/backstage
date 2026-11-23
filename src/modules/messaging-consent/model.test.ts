import { applyEvent, INITIAL_CONSENT, simulate } from './model';

const byId = (result: ReturnType<typeof simulate>, id: string) => result.items.find((i) => i.id === id);

describe('마케팅 동의 모델', () => {
  it('요청 생성 시에만 확인하면 끈 뒤에도 예약된 마케팅 메일이 나가고 위반으로 세요', () => {
    const r = simulate('create', 'email-off');
    expect(byId(r, 'mail-promo')?.status).toBe('sent');
    expect(byId(r, 'mail-promo')?.violation).toBe(true);
    expect(r.violations).toBe(1);
  });

  it('발송 직전에 다시 확인하면 같은 메일이 막히고 위반은 0이에요', () => {
    const r = simulate('send', 'email-off');
    expect(byId(r, 'mail-promo')?.status).toBe('blocked');
    expect(r.violations).toBe(0);
    expect(r.blocked).toBe(1);
  });

  it('거래 알림은 어떤 사건이 있어도 나가요', () => {
    for (const event of ['email-off', 'one-click-email', 'sms-off', 'forged-one-click', 'none'] as const) {
      for (const checkAt of ['create', 'send'] as const) {
        const r = simulate(checkAt, event);
        expect(byId(r, 'mail-order')?.status).toBe('sent');
      }
    }
  });

  it('메일 동의를 끄면 같은 사용자의 문자 마케팅은 그대로 나가요', () => {
    const r = simulate('send', 'email-off');
    expect(byId(r, 'sms-promo')?.status).toBe('sent');
    expect(byId(r, 'sms-promo')?.violation).toBe(false);
  });

  it('원클릭 수신 거부는 메일 채널의 마케팅 동의만 끄는 설정 변경과 같아요', () => {
    expect(applyEvent(INITIAL_CONSENT, 'one-click-email')).toEqual(applyEvent(INITIAL_CONSENT, 'email-off'));
    expect(applyEvent(INITIAL_CONSENT, 'one-click-email')).toEqual({ email: false, sms: true, push: true });
  });

  it('토큰이 틀린 위조 요청은 동의 상태를 바꾸지 않아요', () => {
    const r = simulate('send', 'forged-one-click');
    expect(r.violations).toBe(0);
    expect(r.blocked).toBe(0);
    expect(r.sent).toBe(3);
  });
});
