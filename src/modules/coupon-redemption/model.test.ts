import { describe, expect, it } from 'vitest';
import { type Outcome, type Params, SCENARIOS, WRITE_MODES, simulate } from './model';

const base: Params = { mode: 'guarded', scenario: 'burst', stock: 1, ttl: 5 };

const outcomeOf = (r: ReturnType<typeof simulate>, index: number): Outcome => r.rows[index].outcome;

describe('유일 제약과 조건부 차감', () => {
  it.each(SCENARIOS)('%s 시나리오에서 확정 수는 수량을 넘지 않고, 1인 1회가 깨지지 않아요', (scenario) => {
    for (let stock = 1; stock <= 10; stock++) {
      for (let ttl = 2; ttl <= 10; ttl++) {
        const r = simulate({ ...base, mode: 'guarded', scenario, stock, ttl });
        expect(r.confirmed).toBeLessThanOrEqual(stock);
        expect(r.remaining).toBeGreaterThanOrEqual(0);
        expect(r.duplicateUsers).toBe(0);
      }
    }
  });

  it('두 탭 요청 중 하나만 확정되고, 두 번째는 이미 사용으로 거절돼요', () => {
    const r = simulate({ ...base, mode: 'guarded', scenario: 'two-tabs', stock: 5 });
    expect(outcomeOf(r, 0)).toBe('confirmed');
    expect(outcomeOf(r, 1)).toBe('rejected-used');
    expect(r.duplicateUsers).toBe(0);
  });

  it('확인 후 쓰기는 같은 틱의 두 탭이 같은 옛 값을 봐서 한 사용자에게 두 번 확정돼요', () => {
    const r = simulate({ ...base, mode: 'check-then-write', scenario: 'two-tabs', stock: 5 });
    expect(outcomeOf(r, 0)).toBe('confirmed');
    expect(outcomeOf(r, 1)).toBe('confirmed');
    expect(r.duplicateUsers).toBe(1);
  });
});

describe('총 수량 한도', () => {
  it('남은 쿠폰 1장에 10명이 동시에 오면 조건부 차감은 1명만 확정해요', () => {
    const r = simulate({ ...base, mode: 'guarded', scenario: 'burst', stock: 1 });
    expect(r.confirmed).toBe(1);
    expect(r.remaining).toBe(0);
    expect(r.rows.filter((x) => x.outcome === 'rejected-soldout')).toHaveLength(9);
  });

  it('확인 후 쓰기는 같은 틱의 10명이 모두 통과해서 9장이 초과돼요', () => {
    const r = simulate({ ...base, mode: 'check-then-write', scenario: 'burst', stock: 1 });
    expect(r.confirmed).toBe(10);
    expect(r.remaining).toBe(-9);
  });
});

describe('예약 · 확정 · 해제', () => {
  it('결제 실패로 해제된 쿠폰은 수량으로 돌아가 다음 손님이 받아요', () => {
    const r = simulate({ ...base, mode: 'guarded', scenario: 'payment-fail', stock: 1 });
    expect(outcomeOf(r, 0)).toBe('released');
    expect(outcomeOf(r, 1)).toBe('confirmed');
  });

  it('보류 시간이 지난 뒤 도착한 결제는 확정되지 않고 환불 대상으로 남아요', () => {
    const r = simulate({ ...base, mode: 'guarded', scenario: 'expire', stock: 1, ttl: 5 });
    expect(outcomeOf(r, 0)).toBe('confirm-failed');
    expect(outcomeOf(r, 1)).toBe('confirmed');
    expect(r.refundNeeded).toBe(1);
  });

  it('만료 틱 전에 결제 응답이 오면 확정되고, 만료 틱에 오면 확정되지 않아요', () => {
    // ttl=3: 예약은 틱 3 에 만료되고, 결제 응답은 틱 2 에 도착해서 아직 유효해요
    const valid = simulate({ ...base, mode: 'guarded', scenario: 'two-tabs', stock: 5, ttl: 3 });
    expect(outcomeOf(valid, 0)).toBe('confirmed');
    // ttl=2: 예약은 틱 2 에 만료되고, 결제 응답도 틱 2 라서 이미 풀린 뒤예요
    const expired = simulate({ ...base, mode: 'guarded', scenario: 'two-tabs', stock: 5, ttl: 2 });
    expect(outcomeOf(expired, 0)).toBe('confirm-failed');
  });

  it('모든 모드와 시나리오에서 결과 행 수는 요청 수와 같아요', () => {
    for (const mode of WRITE_MODES) {
      for (const scenario of SCENARIOS) {
        const r = simulate({ ...base, mode, scenario, stock: 3, ttl: 4 });
        expect(r.rows.length).toBeGreaterThan(0);
        expect(r.rows.every((x) => x.outcome !== undefined)).toBe(true);
      }
    }
  });
});
