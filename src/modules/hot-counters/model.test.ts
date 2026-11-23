import { describe, expect, it } from 'vitest';
import { HORIZON, type Params, type Strategy, formatCount, simulate } from './model';

const base: Params = {
  strategy: 'single',
  method: 'post',
  shards: 4,
  flushEvery: 4,
  likesPerTick: 60,
  unlikeRate: 0,
  doubleTapRate: 0.2,
  crashTick: null,
  seed: 7,
};

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const STRATEGIES: Strategy[] = ['single', 'sharded', 'buffered', 'log'];

describe('핫 행 경합', () => {
  it('한 행에 몰리면 대기열이 가장 길어요', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const single = simulate({ ...base, seed, strategy: 'single' });
      expect(single.peakQueue).toBeGreaterThan(0);
      for (const strategy of ['sharded', 'buffered', 'log'] as const) {
        expect(simulate({ ...base, seed, strategy }).peakQueue).toBeLessThanOrEqual(single.peakQueue);
      }
    }
  });

  it.each([2, 4, 8])('샤드 %i개면 행 하나가 받는 쓰기가 약 1/N 이 돼요', (n) => {
    for (const seed of SEEDS.slice(0, 5)) {
      const single = simulate({ ...base, seed, strategy: 'single' });
      const sharded = simulate({ ...base, seed, strategy: 'sharded', shards: n });
      expect(sharded.hotRowWrites).toBe(single.hotRowWrites);
      const ratio = sharded.peakRowWrites / single.hotRowWrites;
      expect(ratio).toBeGreaterThan(0.7 / n);
      expect(ratio).toBeLessThan(1.3 / n);
    }
  });

  it('버퍼는 틱마다 행을 건드리지 않고 주기 반영 때만 써요', () => {
    const r = simulate({ ...base, strategy: 'buffered', flushEvery: 10 });
    expect(r.hotRowWrites).toBeLessThanOrEqual(Math.ceil((HORIZON + 1) / 10));
  });
});

describe('버퍼 반영', () => {
  it.each([1, 3, 10])('주기 %i 에서 PUT 으로 모으면 끝에는 실제 수와 같아요', (flushEvery) => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, strategy: 'buffered', method: 'put', flushEvery });
      expect(r.finalDisplayed).toBe(r.finalTruth);
      expect(r.lost).toBe(0);
    }
  });

  it('반영 전에 장애가 나면 아직 반영되지 않은 증가분만 잃어요', () => {
    const crashTick = 25;
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, strategy: 'buffered', method: 'put', flushEvery: 10, crashTick });
      const unflushed = r.deltaByTick.slice(20, crashTick + 1).reduce((a, b) => a + b, 0);
      expect(r.lost).toBe(unflushed);
      expect(r.finalDisplayed).toBe(r.finalTruth - r.lost);
    }
  });

  it('로그 집계는 장애가 나도 잃는 값이 없어요', () => {
    const r = simulate({ ...base, strategy: 'log', method: 'put', flushEvery: 10, crashTick: 25 });
    expect(r.lost).toBe(0);
    expect(r.finalDisplayed).toBe(r.finalTruth);
  });

  it('반영 주기가 길수록 실제 수와 표시 수의 차이가 커져요', () => {
    const lagAt = (flushEvery: number) =>
      Math.max(...simulate({ ...base, strategy: 'buffered', method: 'put', flushEvery }).lagByTick);
    expect(lagAt(10)).toBeGreaterThan(lagAt(1));
  });
});

describe('멱등 토글', () => {
  it('PUT 은 더블 탭이 있어도 숫자를 두 번 세지 않아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, method: 'put', doubleTapRate: 0.3, unlikeRate: 0.2 });
      expect(r.duplicateRequests).toBeGreaterThan(0);
      expect(r.drift).toBe(0);
    }
  });

  it('POST 는 더블 탭 요청 수만큼 더 세요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, method: 'post', doubleTapRate: 0.3, unlikeRate: 0 });
      expect(r.drift).toBe(r.duplicateRequests);
    }
  });
});

describe('결정성과 표시 형식', () => {
  it('같은 시드는 항상 같은 결과를 내요', () => {
    for (const strategy of STRATEGIES) {
      expect(simulate({ ...base, strategy })).toEqual(simulate({ ...base, strategy }));
    }
  });

  it('만 단위는 소수 한 자리로 줄여요', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(12345)).toBe('1.2만');
  });
});
