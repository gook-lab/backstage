import { describe, expect, it } from 'vitest';
import { HORIZON, type Params, simulate } from './model';

const base: Params = {
  reporters: 3,
  retries: 0,
  dedupe: true,
  threshold: 5,
  brigade: 0,
  reviewers: 2,
  queue: 'select',
  backlog: 0,
  seed: 1,
};

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

describe('신고 중복 막기', () => {
  it('유니크 제약을 쓰면 같은 사람의 재시도는 집계되지 않고 막힌 수로 남아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, reporters: 4, retries: 3, dedupe: true });
      expect(r.duplicateCounted).toBe(0);
      expect(r.duplicateBlocked).toBe(4 * 3);
      expect(r.counted.violating).toBe(4);
    }
  });

  it('유니크 제약이 없으면 재시도 한 번이 신고 한 건으로 세어져요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, reporters: 4, retries: 3, dedupe: false });
      expect(r.duplicateBlocked).toBe(0);
      expect(r.duplicateCounted).toBe(4 * 3);
      expect(r.counted.violating).toBe(4 * 4);
    }
  });

  it('재시도로 부풀린 집계가 임계값을 넘으면 실제 신고자가 적어도 숨겨져요', () => {
    const naive = simulate({ ...base, reporters: 2, retries: 2, dedupe: false, threshold: 5 });
    const unique = simulate({ ...base, reporters: 2, retries: 2, dedupe: true, threshold: 5 });
    expect(naive.hideAt.violating).toBeDefined();
    expect(unique.hideAt.violating).toBeUndefined();
  });
});

describe('조직적 신고', () => {
  it('유니크 제약으로는 서로 다른 계정의 조직 신고를 막지 못해요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, reporters: 0, brigade: 5, threshold: 5, dedupe: true });
      expect(r.counted.legit).toBe(5);
      expect(r.falseHides).toBe(1);
    }
  });

  it('조직 신고가 임계값보다 적으면 정상 글은 숨겨지지 않아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, reporters: 0, brigade: 4, threshold: 5 });
      expect(r.hideAt.legit).toBeUndefined();
      expect(r.falseHides).toBe(0);
    }
  });

  it('임계값에 못 미치면 정책 위반 글도 숨기지 않아요', () => {
    const r = simulate({ ...base, reporters: 3, retries: 0, dedupe: true, threshold: 5 });
    expect(r.hideAt.violating).toBeUndefined();
    expect(r.violatingDecidedAt).toBeUndefined();
  });
});

describe('검수 대기열 동시 처리', () => {
  it('일반 SELECT로 두 검수자가 같은 항목을 잡으면 두 번 처리가 생겨요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, queue: 'select', reviewers: 2, backlog: 3, threshold: 3 });
      expect(r.doubleReviewed).toBeGreaterThan(0);
    }
  });

  it('FOR UPDATE SKIP LOCKED로 잡으면 검수자 수와 대기 항목 수에 상관없이 두 번 처리되지 않아요', () => {
    for (const seed of SEEDS) {
      for (const reviewers of [1, 2, 3, 4]) {
        for (const backlog of [0, 3, 10]) {
          const r = simulate({ ...base, seed, queue: 'skip', reviewers, backlog, reporters: 6, threshold: 2 });
          expect(r.doubleReviewed).toBe(0);
        }
      }
    }
  });
});

describe('시뮬레이터 안정성', () => {
  it('같은 입력이면 같은 결과가 나와요', () => {
    const p: Params = { ...base, reporters: 9, retries: 2, dedupe: false, brigade: 6, backlog: 4, seed: 42 };
    expect(simulate(p)).toEqual(simulate(p));
  });

  it('대기열 항목 수를 바꿔도 신고 집계는 그대로예요', () => {
    const a = simulate({ ...base, backlog: 0, seed: 9, reporters: 7, brigade: 4 });
    const b = simulate({ ...base, backlog: 12, seed: 9, reporters: 7, brigade: 4 });
    expect(b.counted).toEqual(a.counted);
    expect(b.hideAt).toEqual(a.hideAt);
  });

  it('숨김 시점과 검수 완료 시점은 시뮬레이션 범위 안에 있어요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, seed, reporters: 10, backlog: 5, threshold: 3 });
      if (r.hideAt.violating !== undefined) expect(r.hideAt.violating).toBeLessThanOrEqual(HORIZON);
      if (r.violatingDecidedAt !== undefined) expect(r.violatingDecidedAt).toBeLessThanOrEqual(HORIZON);
    }
  });
});
