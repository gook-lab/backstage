import { describe, expect, it } from 'vitest';
import { HORIZON, POLICIES, type Params, simulate } from './model';

const base: Params = {
  policy: 'cart',
  mode: 'atomic',
  stock: 20,
  shoppers: 60,
  ttl: 8,
  abandonRate: 0.3,
  seed: 7,
};

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('원자적 차감', () => {
  it.each(POLICIES)('%s 정책은 여러 시드와 TTL, 재고 조합에서 초과 판매가 없어요', (policy) => {
    for (const seed of SEEDS) {
      for (const ttl of [1, 4, 8, 20]) {
        for (const stock of [1, 5, 20]) {
          const r = simulate({ ...base, policy, mode: 'atomic', seed, ttl, stock, abandonRate: 0.5 });
          expect(r.oversold).toBe(0);
          expect(r.sold).toBeLessThanOrEqual(stock);
          expect(r.heldByTick.at(-1)).toBe(0);
        }
      }
    }
  });
});

describe('읽고 나서 쓰기', () => {
  it('결제 확정 시점에 차감하면 같은 재고를 두 명이 가져가 초과 판매가 생겨요', () => {
    const oversoldSeeds = SEEDS.filter(
      (seed) => simulate({ ...base, policy: 'payment', mode: 'naive', seed }).oversold > 0,
    );
    expect(oversoldSeeds.length).toBeGreaterThan(0);
  });

  it('장바구니 보류도 같은 방식으로 쓰면 보류 수가 재고를 넘어 판매로 이어져요', () => {
    const over = SEEDS.some(
      (seed) => simulate({ ...base, policy: 'cart', mode: 'naive', seed, abandonRate: 0 }).oversold > 0,
    );
    expect(over).toBe(true);
  });
});

describe('구매 결과 합계', () => {
  it.each(POLICIES)('%s 정책에서 모든 손님은 결과 하나로 끝나요', (policy) => {
    for (const mode of ['atomic', 'naive'] as const) {
      for (const seed of SEEDS.slice(0, 10)) {
        const r = simulate({ ...base, policy, mode, seed });
        const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
        expect(total).toBe(base.shoppers);
        expect(r.outcomes).toHaveLength(base.shoppers);
        expect(r.soldOutSeen).toBe(
          r.counts['sold-out-cart'] + r.counts['sold-out-checkout'] + r.counts['sold-out-pay'],
        );
      }
    }
  });
});

describe('보류 해제', () => {
  it('보류는 만든 틱부터 TTL 틱 동안만 재고를 잡고 그 뒤에는 풀려요', () => {
    const ttl = 3;
    const r = simulate({ ...base, policy: 'cart', mode: 'atomic', stock: 1000, shoppers: 30, ttl, abandonRate: 1 });
    for (let t = 0; t <= HORIZON; t++) {
      const expected = r.shoppers.filter((s) => s.add <= t && t < s.add + ttl).length;
      expect(r.stuckByTick[t]).toBe(expected);
    }
    expect(r.stuckByTick.at(-1)).toBe(0);
  });

  it('체크아웃 보류가 TTL 안에 결제를 덮으면 결제 때 품절이 나지 않아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, policy: 'checkout', mode: 'atomic', seed, ttl: 8, stock: 5 });
      expect(r.counts['sold-out-pay']).toBe(0);
    }
  });

  it('TTL 이 결제 전에 끝나면 보류가 풀린 뒤 다시 확인해서 결제 때 품절을 볼 수 있어요', () => {
    const r = SEEDS.map((seed) => simulate({ ...base, policy: 'checkout', mode: 'atomic', seed, ttl: 1, stock: 5 }));
    expect(r.some((x) => x.counts['sold-out-pay'] > 0)).toBe(true);
    expect(r.every((x) => x.oversold === 0)).toBe(true);
  });
});

describe('장바구니 보류의 비용', () => {
  it('포기한 손님의 보류가 재고를 잡으면 아직 남은 재고가 있는데도 담을 때 품절이 나요', () => {
    const phantom = SEEDS.some((seed) => {
      const r = simulate({ ...base, policy: 'cart', mode: 'atomic', seed, ttl: 20, stock: 10, abandonRate: 0.6 });
      return r.counts['sold-out-cart'] > 0 && r.sold < 10;
    });
    expect(phantom).toBe(true);
  });
});

describe('결정성', () => {
  it('같은 입력은 항상 같은 결과를 내요', () => {
    expect(simulate(base)).toEqual(simulate(base));
  });
});
