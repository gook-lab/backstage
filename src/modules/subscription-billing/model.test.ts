import { attemptDaysOf, clampChangeDay, computeProration, recoverOptions, simulateDunning } from './model';

describe('구독 플랜 변경 일할 계산 모델', () => {
  it('중간에 올리면 미사용분 크레딧과 새 플랜 차감이 함께 잡혀 차액만 청구돼요', () => {
    const r = computeProration({ fromPrice: 9900, toPrice: 19900, changeDay: 16, mode: 'immediate' });
    expect(r.remainingDays).toBe(15);
    expect(r.creditOld).toBe(4950);
    expect(r.debitNew).toBe(9950);
    expect(r.net).toBe(5000);
    expect(r.chargeNow).toBe(5000);
    expect(r.nextInvoice).toBe(19900);
  });

  it('다음 청구서에 넣으면 이번에는 0원이고, 다음 청구는 정가에 차액이 더해져요', () => {
    const r = computeProration({ fromPrice: 9900, toPrice: 19900, changeDay: 16, mode: 'next-invoice' });
    expect(r.chargeNow).toBe(0);
    expect(r.nextInvoice).toBe(24900);
  });

  it('일할 계산을 끄면 차액이 없고, 다음 청구는 새 플랜 정가예요', () => {
    const r = computeProration({ fromPrice: 9900, toPrice: 19900, changeDay: 16, mode: 'none' });
    expect(r.net).toBe(0);
    expect(r.chargeNow).toBe(0);
    expect(r.creditBalance).toBe(0);
    expect(r.nextInvoice).toBe(19900);
  });

  it('내리면 즉시 청구는 0원이고 차액은 크레딧 잔액으로 남아요 (환불하지 않아요)', () => {
    const r = computeProration({ fromPrice: 29900, toPrice: 9900, changeDay: 1, mode: 'immediate' });
    expect(r.remainingDays).toBe(30);
    expect(r.net).toBe(-20000);
    expect(r.chargeNow).toBe(0);
    expect(r.creditBalance).toBe(20000);
    expect(r.nextInvoice).toBe(9900);
  });

  it('다음 청구서에서 크레딧이 정가보다 크면 청구액은 0원이고 남은 크레딧이 이월돼요', () => {
    const r = computeProration({ fromPrice: 29900, toPrice: 9900, changeDay: 1, mode: 'next-invoice' });
    expect(r.nextInvoice).toBe(0);
    expect(r.creditBalance).toBe(10100);
  });

  it('원 단위 반올림은 0.5 를 올려요 (663.33 → 663, 996.67 → 997)', () => {
    const r = computeProration({ fromPrice: 19900, toPrice: 29900, changeDay: 30, mode: 'immediate' });
    expect(r.remainingDays).toBe(1);
    expect(r.creditOld).toBe(663);
    expect(r.debitNew).toBe(997);
    expect(r.chargeNow).toBe(334);
  });

  it('변경일이 범위를 벗어나면 1 또는 30 으로 맞춰요', () => {
    expect(clampChangeDay(0)).toBe(1);
    expect(clampChangeDay(31)).toBe(30);
    expect(clampChangeDay(Number.NaN)).toBe(1);
    expect(computeProration({ fromPrice: 9900, toPrice: 9900, changeDay: 0, mode: 'immediate' }).remainingDays).toBe(
      30,
    );
  });
});

describe('결제 실패 재시도 · 유예 모델', () => {
  it('재시도 간격으로 시도 날짜가 누적되고, 0일이 최초 청구예요', () => {
    expect(attemptDaysOf('short')).toEqual([0, 1, 3, 6]);
    expect(attemptDaysOf('wide')).toEqual([0, 3, 8, 15]);
    expect(attemptDaysOf('none')).toEqual([0]);
  });

  it('유예 기간 3일이면 실패 뒤 3일째부터 기능이 막혀요', () => {
    const r = simulateDunning({ retryPlan: 'short', recoverAt: 0, finalOutcome: 'past_due', graceDays: 3 });
    expect(r.blockedFrom).toBe(3);
    expect(r.accessDaysCount).toBe(3);
    expect(r.days[2].access).toBe(true);
    expect(r.days[3].access).toBe(false);
    expect(r.days[3].status).toBe('past_due');
  });

  it('두 번째 재시도에서 결제가 성공하면 그날부터 active 가 되고 기능이 다시 열려요', () => {
    const r = simulateDunning({ retryPlan: 'short', recoverAt: 2, finalOutcome: 'canceled', graceDays: 0 });
    expect(r.recoveredOn).toBe(3);
    expect(r.blockedFrom).toBe(0);
    expect(r.days[2].status).toBe('past_due');
    expect(r.days[3].status).toBe('active');
    expect(r.days[3].access).toBe(true);
    expect(r.accessDaysCount).toBe(28);
  });

  it('재시도 없이 최종 결과가 canceled 면 마지막 재시도 다음 날 해지되고 접근이 끊겨요', () => {
    const r = simulateDunning({ retryPlan: 'none', recoverAt: 0, finalOutcome: 'canceled', graceDays: 7 });
    expect(r.finalStartDay).toBe(1);
    expect(r.days[0].access).toBe(true);
    expect(r.days[1].status).toBe('canceled');
    expect(r.blockedFrom).toBe(1);
    expect(r.accessDaysCount).toBe(1);
  });

  it('넓은 재시도에서 최종 unpaid 면 재시도 중에는 past_due 이고 마지막 재시도 다음 날 unpaid 가 돼요', () => {
    const r = simulateDunning({ retryPlan: 'wide', recoverAt: 0, finalOutcome: 'unpaid', graceDays: 14 });
    expect(r.finalStartDay).toBe(16);
    expect(r.days[15].status).toBe('past_due');
    expect(r.days[16].status).toBe('unpaid');
    expect(r.blockedFrom).toBe(14);
    expect(r.accessDaysCount).toBe(14);
  });

  it('재시도 횟수보다 큰 성공 번호는 무시하고 모두 실패로 계산해요', () => {
    expect(recoverOptions('none')).toEqual([0]);
    const r = simulateDunning({ retryPlan: 'none', recoverAt: 2, finalOutcome: 'past_due', graceDays: 0 });
    expect(r.recoveredOn).toBeNull();
  });
});
