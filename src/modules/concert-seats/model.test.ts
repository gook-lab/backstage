import { describe, expect, it } from 'vitest';
import { DEFAULT_TTL, makePlans, simulate, type Config, type Plan, type Strategy } from './model';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function config(overrides: Partial<Config> & { strategy: Strategy }): Config {
  return { users: 30, seats: 10, ttl: DEFAULT_TTL, expiry: true, seed: 1, ...overrides };
}

function last(c: Config, plans?: readonly Plan[]) {
  const { frames } = simulate(c, plans);
  return frames[frames.length - 1];
}

describe('같은 시드는 같은 결과를 낸다', () => {
  it('두 번 돌려도 프레임 수와 마지막 상태가 같다', () => {
    const c = config({ strategy: 'naive', seed: 42 });
    const a = simulate(c);
    const b = simulate(c);
    expect(b.frames.length).toBe(a.frames.length);
    expect(b.frames.at(-1)).toEqual(a.frames.at(-1));
  });
});

describe('읽고 나서 쓰기 (naive)', () => {
  it.each(SEEDS)('시드 %i: 같은 좌석을 두 사람이 읽고 쓰면 이중 예약이 생긴다', (seed) => {
    const final = last(config({ strategy: 'naive', seed }));
    expect(final.stats.doubleBookings).toBeGreaterThan(0);
  });

  it('덮어쓰인 사용자가 결제하면 결제 콜백에서 환불된다', () => {
    const final = last(config({ strategy: 'naive', seed: 1, expiry: false }));
    expect(final.stats.refunds).toBeGreaterThan(0);
    expect(final.stats.sold).toBeLessThanOrEqual(10);
  });
});

describe('서버가 조건을 확인하는 방식은 이중 예약을 내지 않는다', () => {
  const safe: Strategy[] = ['conditional', 'unique', 'skip-locked'];

  it.each(safe.flatMap((strategy) => SEEDS.map((seed) => [strategy, seed] as const)))(
    '%s · 시드 %i: 이중 예약 0건',
    (strategy, seed) => {
      for (const expiry of [true, false]) {
        const final = last(config({ strategy, seed, expiry }));
        expect(final.stats.doubleBookings).toBe(0);
      }
    },
  );

  it.each(SEEDS)('조건부 UPDATE · 시드 %i: 실패한 시도는 409 로 집계된다', (seed) => {
    const final = last(config({ strategy: 'conditional', seed, users: 60, seats: 5 }));
    expect(final.stats.conflicts).toBeGreaterThan(0);
    expect(final.stats.holds + final.stats.conflicts).toBe(60);
  });

  it('보류 만료를 끈 상태에서 조건부 UPDATE 와 UNIQUE 는 노린 좌석마다 한 번만 성공한다', () => {
    for (const strategy of ['conditional', 'unique'] as const) {
      const c = config({ strategy, seed: 9, expiry: false, users: 40, seats: 8 });
      const plans = makePlans(c);
      const targeted = new Set(plans.map((p) => p.target)).size;
      expect(last(c, plans).stats.holds).toBe(targeted);
    }
  });
});

describe('SKIP LOCKED 자동 배정', () => {
  it.each(SEEDS)('시드 %i: 만료가 없으면 좌석 수만큼 서로 다른 좌석에 배정된다', (seed) => {
    const c = config({ strategy: 'skip-locked', seed, users: 25, seats: 6, expiry: false });
    const final = last(c);
    const holders = final.seats.map((s) => s.holder).filter((h): h is number => h !== null);
    expect(final.stats.holds).toBe(6);
    expect(new Set(holders).size).toBe(holders.length);
    expect(final.stats.conflicts).toBe(19);
  });
});

describe('보류 만료', () => {
  it('보류 시각이 지나야 좌석이 다시 비고, 그 틱에는 아직 잡혀 있다', () => {
    const c = config({ strategy: 'conditional', users: 2, seats: 1, ttl: 5, expiry: true });
    const first: Plan = { target: 0, startAt: 0, abandon: true, payDelay: 1 };
    const sameTick: Plan = { target: 0, startAt: 5, abandon: true, payDelay: 1 };
    const afterTtl: Plan = { target: 0, startAt: 6, abandon: true, payDelay: 1 };

    const blocked = simulate(c, [first, sameTick]).frames.at(-1);
    expect(blocked?.stats.conflicts).toBe(1);
    expect(blocked?.stats.holds).toBe(1);

    const freed = simulate(c, [first, afterTtl]).frames.at(-1);
    expect(freed?.stats.conflicts).toBe(0);
    expect(freed?.stats.holds).toBe(2);
    expect(freed?.stats.released).toBe(1);
  });

  it('결제하지 않은 보류는 만료를 끄면 끝까지 남아 있다', () => {
    const c = config({ strategy: 'conditional', users: 1, seats: 1, expiry: false });
    const abandoned: Plan = { target: 0, startAt: 0, abandon: true, payDelay: 1 };
    expect(last(c, [abandoned]).seats[0].view).toBe('HELD');
  });

  it('결제 콜백이 보류 만료 뒤에 도착하면 확정하지 않고 환불한다', () => {
    const c = config({ strategy: 'conditional', users: 1, seats: 1, ttl: 5, expiry: true });
    const late: Plan = { target: 0, startAt: 0, abandon: false, payDelay: 10 };
    const final = last(c, [late]);
    expect(final.stats.sold).toBe(0);
    expect(final.stats.refunds).toBe(1);
    expect(final.seats[0].view).toBe('AVAILABLE');
  });

  it('제때 결제한 보류는 확정되고 좌석이 SOLD 가 된다', () => {
    const c = config({ strategy: 'conditional', users: 1, seats: 1, ttl: 5, expiry: true });
    const onTime: Plan = { target: 0, startAt: 0, abandon: false, payDelay: 2 };
    const final = last(c, [onTime]);
    expect(final.stats.sold).toBe(1);
    expect(final.seats[0].view).toBe('SOLD');
  });
});
