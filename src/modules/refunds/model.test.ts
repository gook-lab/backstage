import { describe, expect, it } from 'vitest';
import { allocate, race, type Item, type RaceParams } from './model';

const ITEMS: readonly Item[] = [
  { name: '원두 A', price: 12000 },
  { name: '원두 B', price: 8000 },
  { name: '드립백', price: 5000 },
];

const EQUAL: readonly Item[] = [
  { name: '가', price: 1000 },
  { name: '나', price: 1000 },
  { name: '다', price: 1000 },
];

describe('비율 배분', () => {
  it('줄 환불액을 더하면 결제액과 정확히 같아요', () => {
    for (let discount = 0; discount <= 25000; discount += 1700) {
      const r = allocate(ITEMS, discount, 'ratio');
      expect(r.rows.reduce((acc, row) => acc + row.share, 0)).toBe(discount);
      expect(r.fullRefundSum).toBe(r.paid);
      expect(r.overRefund).toBe(0);
    }
  });

  it('끝수 1원은 금액이 큰 줄부터 배정하고, 같은 금액이면 앞 줄부터 배정해요', () => {
    const r = allocate(EQUAL, 1000, 'ratio');
    expect(r.rows.map((row) => row.share)).toEqual([334, 333, 333]);
    expect(r.remainder).toBe(1);
  });

  it('줄마다 반올림만 하면 합계가 할인액과 1원 어긋나요', () => {
    const r = allocate(EQUAL, 1000, 'ratio');
    expect(r.roundingGap).toBe(-1);
  });

  it('상품 하나만 취소하면 그 줄의 쿠폰 몫을 뺀 금액을 돌려줘요', () => {
    const r = allocate(ITEMS, 5000, 'ratio');
    // 원두 A: 12000 - floor(5000 * 12000 / 25000) = 12000 - 2400
    expect(r.rows[0]).toMatchObject({ share: 2400, refund: 9600 });
  });
});

describe('첫 상품 몰아주기', () => {
  it('할인을 앞 줄부터 채우고 남은 할인은 다음 줄로 넘겨요', () => {
    const r = allocate(ITEMS, 15000, 'first');
    expect(r.rows.map((row) => row.share)).toEqual([12000, 3000, 0]);
    expect(r.fullRefundSum).toBe(r.paid);
  });
});

describe('배분 없음', () => {
  it('할인을 줄에 나누지 않아서 전체 취소 환불이 결제액보다 할인액만큼 많아요', () => {
    const r = allocate(ITEMS, 5000, 'none');
    expect(r.paid).toBe(20000);
    expect(r.fullRefundSum).toBe(25000);
    expect(r.overRefund).toBe(5000);
  });
});

describe('주문 쿠폰 할인 입력', () => {
  it('상품 합을 넘는 할인은 상품 합까지만 적용해요', () => {
    const r = allocate(ITEMS, 999999, 'ratio');
    expect(r.discount).toBe(25000);
    expect(r.paid).toBe(0);
  });
});

describe('두 환불 요청이 겹칠 때', () => {
  const base: RaceParams = {
    paid: 30000,
    refunded: 10000,
    amountA: 15000,
    amountB: 12000,
    sameRequest: false,
    guard: 'none',
  };

  it('방어가 없으면 옛 값을 같이 읽어 둘 다 통과하고 결제액을 7000원 넘어요', () => {
    const r = race(base);
    expect(r.steps.map((s) => s.outcome)).toEqual(['passed', 'passed']);
    expect(r.total).toBe(37000);
    expect(r.excess).toBe(7000);
  });

  it('조건부 갱신은 앞 요청이 쓴 값을 보고 두 번째 요청을 거절해요', () => {
    const r = race({ ...base, guard: 'conditional' });
    expect(r.steps.map((s) => s.outcome)).toEqual(['passed', 'rejected']);
    expect(r.total).toBe(25000);
    expect(r.excess).toBe(0);
  });

  it('멱등성 키만으로는 서로 다른 두 환불이 합쳐져 넘는 것을 막지 못해요', () => {
    const r = race({ ...base, guard: 'idempotency' });
    expect(r.excess).toBe(7000);
  });

  it('같은 요청을 두 번 보내도 멱등성 키가 있으면 두 번째는 첫 결과를 돌려받아요', () => {
    const r = race({ ...base, sameRequest: true, amountA: 5000, guard: 'idempotency' });
    expect(r.steps.map((s) => s.outcome)).toEqual(['passed', 'deduped']);
    expect(r.total).toBe(15000);
  });

  it('조건부 갱신만으로는 같은 요청 두 번을 막지 못하고, 한도 안이면 두 번 환불돼요', () => {
    const r = race({ ...base, sameRequest: true, amountA: 5000, guard: 'conditional' });
    expect(r.steps.map((s) => s.outcome)).toEqual(['passed', 'passed']);
    expect(r.total).toBe(20000);
  });

  it('둘 다 쓰면 같은 요청은 한 번만, 서로 다른 요청은 한도 안에서만 통과해요', () => {
    expect(race({ ...base, sameRequest: true, amountA: 5000, guard: 'both' }).total).toBe(15000);
    expect(race({ ...base, guard: 'both' }).excess).toBe(0);
  });

  it('환불 가능 잔액은 결제액에서 이미 환불한 합계를 뺀 값이에요', () => {
    expect(race(base).available).toBe(20000);
  });
});
