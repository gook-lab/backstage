import { describe, expect, it } from 'vitest';
import { compareStrategies, simulate, STRATEGIES, type Config, type Strategy } from './model';

const base: Config = {
  strategy: 'random',
  replicas: 3,
  lagMs: 400,
  spikePct: 3,
  windowMs: 5000,
  writesPerSec: 10,
  seed: 7,
};

/** 복제 지연이 아주 길어서 전략 차이가 잘 드러나는 상황 */
const slow: Omit<Config, 'strategy'> = {
  replicas: 5,
  lagMs: 1500,
  spikePct: 3,
  windowMs: 5000,
  writesPerSec: 10,
  seed: 7,
};

function run(strategy: Strategy, overrides: Partial<Config> = {}) {
  return simulate({ ...base, strategy, ...overrides });
}

describe('같은 시드는 같은 결과를 낸다', () => {
  it.each(STRATEGIES.map((s) => s.id))('%s 는 두 번 돌려도 결과가 같아요', (strategy) => {
    expect(run(strategy, { seed: 42 })).toEqual(run(strategy, { seed: 42 }));
  });
});

describe('복제 지연이 짧으면 첫 화면에서 글이 보여요', () => {
  it('복제본 하나, 지연 50ms, 튐 없음이면 무작위로 골라도 빠진 글이 없어요', () => {
    const result = run('random', { replicas: 1, lagMs: 50, spikePct: 0 });
    expect(result.firstMisses).toBe(0);
    expect(result.regressions).toBe(0);
  });
});

describe('무작위 복제본 — 방금 쓴 글이 빠지고 값이 뒤로 가요', () => {
  it('기본 설정에서 첫 목록에 글이 없는 세션이 있어요', () => {
    expect(run('random').firstMisses).toBeGreaterThan(0);
  });

  it('느린 복제본이 섞이면 새로고침 때 보였던 글이 사라지는 일이 생겨요', () => {
    expect(run('random', slow).regressions).toBeGreaterThan(0);
  });

  it('주 DB 에서는 한 번도 읽지 않아요', () => {
    expect(run('random').primaryReads).toBe(0);
  });
});

describe('세션마다 복제본 고정 — 값은 뒤로 가지 않지만 첫 화면은 그대로예요', () => {
  it('느린 상황에서도 새로고침 때 값이 뒤로 가지 않아요', () => {
    expect(run('sticky', slow).regressions).toBe(0);
  });

  it('고른 복제본이 늦으면 방금 쓴 글은 계속 안 보여요', () => {
    expect(run('sticky').firstMisses).toBeGreaterThan(0);
  });
});

describe('쓴 뒤 N초 주 DB — 쓴 직후에는 주 DB 가 답해요', () => {
  it('기본 설정에서 첫 화면 미노출이 없고, 주 DB 읽기가 생겨요', () => {
    const result = run('window');
    expect(result.firstMisses).toBe(0);
    expect(result.primaryReads).toBeGreaterThan(0);
  });

  it('N초를 0으로 두면 주 DB 로 가는 읽기가 없어요', () => {
    expect(run('window', { windowMs: 0 }).primaryReads).toBe(0);
  });

  it('N초가 지나면 복제본으로 가서, 느린 복제본에서는 값이 뒤로 갈 수 있어요', () => {
    expect(run('window', slow).regressions).toBeGreaterThan(0);
  });
});

describe('쓴 위치 확인 — 따라온 복제본만 읽어요', () => {
  it.each([400, 1500])('지연 %ims 에서도 빠진 글과 뒤로 간 값이 없어요', (lagMs) => {
    const result = run('lsn', { lagMs, replicas: 5 });
    expect(result.firstMisses).toBe(0);
    expect(result.regressions).toBe(0);
  });

  it('주 DB 읽기는 쓴 뒤 N초 방식보다 훨씬 적어요', () => {
    expect(run('lsn').primaryShare).toBeLessThan(run('window').primaryShare);
  });
});

describe('응답 글 직접 넣기 — 첫 화면은 보장하지만 새로고침은 못 막아요', () => {
  it('첫 화면에서는 빠진 글이 없어요', () => {
    expect(run('response', slow).firstMisses).toBe(0);
  });

  it('느린 복제본이 섞이면 새로고침 때 값이 뒤로 갈 수 있어요', () => {
    expect(run('response', slow).regressions).toBeGreaterThan(0);
  });
});

describe('비교 표 — 같은 조건의 다섯 전략', () => {
  it('전략마다 한 줄씩 나오고, 같은 설정이면 개별 실행과 결과가 같아요', () => {
    const rows = compareStrategies(base);
    expect(rows.map((r) => r.id)).toEqual(STRATEGIES.map((s) => s.id));
    expect(rows.find((r) => r.id === 'lsn')?.result).toEqual(run('lsn'));
  });
});
