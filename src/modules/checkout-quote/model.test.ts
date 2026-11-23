import { describe, expect, it } from 'vitest';
import { QUOTED, SCENARIOS, type Scenario, type Strategy, currentPricing, settle, total } from './model';

const AGES = [0, 5, 11, 15];

describe('견적 id + 재계산', () => {
  it('어떤 사건과 시점에서도 청구 금액은 0 이거나 서버 계산 금액과 같아요', () => {
    for (const scenario of SCENARIOS) {
      for (const ageMin of AGES) {
        for (const reconfirmed of [false, true]) {
          const quote = reconfirmed ? currentPricing(scenario) : QUOTED;
          const r = settle({ scenario, strategy: 'quote-recompute', quote, ageMin });
          expect(r.charged === 0 || r.charged === r.serverTotal).toBe(true);
          expect(Number.isInteger(r.charged)).toBe(true);
          expect(Number.isInteger(r.serverTotal)).toBe(true);
        }
      }
    }
  });

  it('가격이 오르면 바뀐 항목을 담아 거절하고 청구하지 않아요', () => {
    const r = settle({ scenario: 'price-up', strategy: 'quote-recompute' });
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('changed');
    expect(r.charged).toBe(0);
    expect(r.shownChanges).toEqual([{ kind: 'price', before: 12000, after: 13000 }]);
  });

  it('견적 유효 시간이 지나면 바뀐 내용이 없어도 거절해요', () => {
    const r = settle({ scenario: 'none', strategy: 'quote-recompute', ageMin: 11 });
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('expired');
    expect(r.charged).toBe(0);
  });

  it('바뀐 금액으로 다시 견적을 받으면 새 금액이 승인돼요', () => {
    const scenario: Scenario = 'price-up';
    const r = settle({ scenario, strategy: 'quote-recompute', quote: currentPricing(scenario), ageMin: 0 });
    expect(r.rejected).toBe(false);
    expect(r.charged).toBe(total(currentPricing(scenario)));
    expect(r.charged).toBe(26000);
  });
});

describe('클라이언트 금액 신뢰', () => {
  it('가격이 오른 뒤에도 옛 견적 금액을 그대로 청구해서 서버 계산과 어긋나요', () => {
    const r = settle({ scenario: 'price-up', strategy: 'trust-client' });
    expect(r.charged).toBe(24000);
    expect(r.serverTotal).toBe(26000);
    expect(r.charged - r.serverTotal).toBe(-2000);
    expect(r.shownChanges).toEqual([]);
  });
});

describe('서버 재계산만', () => {
  it('바뀐 금액을 청구하면서 사용자에게 변경 항목을 보여 주지 않아요', () => {
    const r = settle({ scenario: 'shipping-change', strategy: 'recompute' });
    expect(r.quotedTotal).toBe(24000);
    expect(r.charged).toBe(26000);
    expect(r.charged).not.toBe(r.quotedTotal);
    expect(r.shownChanges).toEqual([]);
    expect(r.rejected).toBe(false);
  });
});

describe('기준 값', () => {
  it('아무 일이 없으면 모든 처리 방식이 같은 금액을 청구해요', () => {
    const strategies: readonly Strategy[] = ['trust-client', 'recompute', 'quote-recompute'];
    for (const strategy of strategies) {
      const r = settle({ scenario: 'none', strategy });
      expect(r.charged).toBe(24000);
      expect(r.rejected).toBe(false);
    }
  });
});
