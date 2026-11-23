import { DAY_MAX, type ExpiryPolicy, type Params, simulate } from './model';

const LOTS = [
  { id: 'A', amount: 3000, expiresDay: 30 },
  { id: 'B', amount: 5000, expiresDay: 60 },
  { id: 'C', amount: 4000, expiresDay: 90 },
];

function base(over: Partial<Params> = {}): Params {
  return {
    lots: LOTS,
    useAmount: 6000,
    useDay: 40,
    cancel: true,
    cancelDay: 70,
    policy: 'none',
    viewDay: 75,
    ...over,
  };
}

function withPolicy(policy: ExpiryPolicy): Params {
  return base({ policy });
}

describe('포인트 원장 모델', () => {
  it('만료 임박 순으로 쓰고 사용 기록에 묶음별 배분을 남긴다', () => {
    const r = simulate(base({ cancel: false, viewDay: 50 }));
    // A 는 30일까지라 40일에는 이미 만료. B 5,000 을 먼저 쓰고 C 에서 1,000 을 쓴다
    expect(r.allocations).toEqual([
      { lotId: 'B', amount: 5000 },
      { lotId: 'C', amount: 1000 },
    ]);
    expect(r.ledger.filter((row) => row.kind === 'use')).toHaveLength(2);
  });

  it('만료일 당일까지 쓸 수 있고 다음 날에는 쓸 수 없다', () => {
    const lots = [{ id: 'A', amount: 1000, expiresDay: 10 }];
    const onLastDay = simulate({
      lots,
      useAmount: 1000,
      useDay: 10,
      cancel: false,
      cancelDay: 0,
      policy: 'none',
      viewDay: 10,
    });
    expect(onLastDay.insufficient).toBe(false);
    const nextDay = simulate({
      lots,
      useAmount: 1000,
      useDay: 11,
      cancel: false,
      cancelDay: 0,
      policy: 'none',
      viewDay: 11,
    });
    expect(nextDay.insufficient).toBe(true);
    expect(nextDay.shortBy).toBe(1000);
  });

  it('복원 안 함 정책이면 만료된 묶음 몫은 돌아오지 않고 복원하지 않은 금액으로 남는다', () => {
    const r = simulate(withPolicy('none'));
    // 12,000 적립 - A 만료 3,000 - 사용 6,000 + C 복원 1,000 = 4,000
    expect(r.balanceAt).toBe(4000);
    expect(r.lotBalanceAt).toEqual({ A: 0, B: 0, C: 4000 });
    expect(r.expiredAt).toBe(3000);
    expect(r.notRestoredAt).toBe(5000);
  });

  it('복원 후 즉시 소멸 정책이면 복원과 소멸이 원장에 둘 다 남고 잔액은 같다', () => {
    const r = simulate(withPolicy('restore-expire'));
    expect(r.balanceAt).toBe(4000);
    expect(r.expiredAt).toBe(8000);
    expect(r.notRestoredAt).toBe(0);
    const day70 = r.ledger.filter((row) => row.day === 70);
    expect(day70.map((row) => [row.kind, row.lotId, row.amount])).toEqual([
      ['restore', 'B', 5000],
      ['expire', 'B', -5000],
      ['restore', 'C', 1000],
    ]);
  });

  it('유효기간 연장 정책이면 취소한 날부터 예시 기간만큼 더 쓸 수 있다', () => {
    const r = simulate(withPolicy('extend'));
    expect(r.balanceAt).toBe(9000);
    expect(r.lotBalanceAt.B).toBe(5000);
    // 취소일 70 + 30 = 100 까지 쓸 수 있고 101일에 소멸한다
    const bAtEnd = simulate({ ...withPolicy('extend'), viewDay: 100 });
    expect(bAtEnd.lotBalanceAt.B).toBe(5000);
    const bAfter = simulate({ ...withPolicy('extend'), viewDay: 101 });
    expect(bAfter.lotBalanceAt.B).toBe(0);
  });

  it('잔액이 모자라면 사용하지 않고 부족한 금액을 알려 준다', () => {
    const r = simulate(base({ useAmount: 13000, cancel: false, viewDay: 40 }));
    expect(r.insufficient).toBe(true);
    expect(r.shortBy).toBe(4000);
    expect(r.allocations).toEqual([]);
    expect(r.balanceAt).toBe(9000);
  });

  it('모든 정책에서 원장의 마지막 잔액은 0이고 행마다 잔액이 이어진다', () => {
    for (const policy of ['none', 'restore-expire', 'extend'] as const) {
      const r = simulate({ ...withPolicy(policy), viewDay: DAY_MAX });
      expect(r.balanceAt).toBe(0);
      let running = 0;
      for (const row of r.ledger) {
        running += row.amount;
        expect(row.balanceAfter).toBe(running);
      }
    }
  });

  it('금액이 정수가 아니면 계산하지 않고 거부한다', () => {
    expect(() => simulate(base({ useAmount: 1000.5 }))).toThrow(RangeError);
  });
});
