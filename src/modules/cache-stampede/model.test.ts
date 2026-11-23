import { describe, expect, it } from 'vitest';
import { perSecond, simulate, STRATEGIES, type Config, type Strategy } from './model';

const TTL_TICKS = 100;
const LAT_TICKS = 5;
const base = { rate: 100, keys: 1, ttlSec: 10, dbMs: 500, seed: 7 };

function run(strategy: Strategy, overrides: Partial<Config> = {}) {
  return simulate({ ...base, strategy, ...overrides });
}

function sumRange(values: readonly number[], start: number, length: number): number {
  return values.slice(start, start + length).reduce((sum, n) => sum + n, 0);
}

describe('같은 시드는 같은 결과를 낸다', () => {
  it.each(STRATEGIES.map((s) => s.id))('%s 는 두 번 돌려도 결과가 같아요', (strategy) => {
    expect(run(strategy, { seed: 42 })).toEqual(run(strategy, { seed: 42 }));
  });
});

describe('일반 캐시 — 만료 순간 미스가 전부 DB 로 가요', () => {
  it('만료 뒤 DB 응답 시간 동안 들어온 요청 수만큼 DB 조회가 동시에 나가요', () => {
    const result = run('none');
    expect(sumRange(result.dbPerTick, TTL_TICKS, LAT_TICKS)).toBe(50);
    expect(result.peakConcurrentDb).toBe(50);
  });

  it('첫 조회가 끝난 뒤에는 다음 요청부터 캐시에서 답해요', () => {
    const result = run('none');
    expect(result.dbPerTick[TTL_TICKS + LAT_TICKS]).toBe(0);
  });
});

describe('요청 병합 (single-flight) — 키 하나당 DB 조회는 하나', () => {
  it.each([1, 5, 20])('키 %i개: 같은 순간 DB 조회는 키 수만큼만 나가요', (keys) => {
    const result = run('single-flight', { keys, rate: 1000 });
    expect(result.peakConcurrentDb).toBe(keys);
  });

  it('만료 한 번에 DB 조회는 한 번이고, 기다린 요청은 DB 를 다시 치지 않아요', () => {
    const result = run('single-flight');
    expect(sumRange(result.dbPerTick, TTL_TICKS, LAT_TICKS)).toBe(1);
    expect(result.dbQueries).toBe(5);
    expect(result.blocked).toBe(250);
  });
});

describe('TTL 지터 — 키가 많을 때 만료 순간을 흩어요', () => {
  it('같은 순간 만료되던 키가 흩어져 동시 조회 피크가 절반 아래로 내려가요', () => {
    const none = run('none', { keys: 20, rate: 200 });
    const jitter = run('jitter', { keys: 20, rate: 200 });
    expect(jitter.peakConcurrentDb * 2).toBeLessThan(none.peakConcurrentDb);
  });
});

describe('확률적 조기 갱신 (XFetch) — 만료 전에 갱신을 시작해요', () => {
  it.each([1, 2, 3, 4, 5])('시드 %i: 만료 순간 기다리는 요청이 없고 갱신은 한 번에 하나예요', (seed) => {
    const result = run('early', { seed });
    expect(result.blocked).toBe(0);
    expect(result.peakConcurrentDb).toBe(1);
    expect(sumRange(result.dbPerTick, 0, TTL_TICKS)).toBeGreaterThan(0);
  });
});

describe('옛 값 먼저 주기 (stale-while-revalidate) — 읽는 쪽은 기다리지 않아요', () => {
  it('만료 뒤에도 옛 값을 주고, 갱신이 끝날 때까지 기다리는 요청이 없어요', () => {
    const result = run('stale');
    expect(result.blocked).toBe(0);
    expect(result.staleServed).toBe(250);
    expect(result.peakConcurrentDb).toBe(1);
    expect(result.dbQueries).toBe(5);
  });
});

describe('DB 조회 막대', () => {
  it.each(STRATEGIES.map((s) => s.id))('%s: 초 단위 막대 60개의 합은 전체 DB 조회 수와 같아요', (strategy) => {
    const result = run(strategy);
    const seconds = perSecond(result.dbPerTick);
    expect(seconds).toHaveLength(60);
    expect(seconds.reduce((sum, n) => sum + n, 0)).toBe(result.dbQueries);
  });
});
