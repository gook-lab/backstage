import { describe, expect, it } from 'vitest';
import { type Params, type Restart, RESTARTS, simulate } from './model';

const base: Params = {
  total: 1000,
  chunk: 100,
  crash: false,
  crashPct: 55,
  restart: 'checkpoint',
  idempotent: true,
  lock: true,
  rival: false,
  seed: 7,
};

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe('멱등 처리', () => {
  it.each(RESTARTS)('%s 재시작이어도 멱등이면 중복 정산이 없고 빠진 건도 없어요', (restart: Restart) => {
    for (const seed of SEEDS) {
      for (const crashPct of [10, 55, 90]) {
        for (const rival of [false, true]) {
          const r = simulate({ ...base, restart, seed, crash: true, crashPct, rival, lock: false });
          expect(r.duplicates).toBe(0);
          expect(r.missing).toBe(0);
        }
      }
    }
  });

  it('처음부터 다시 돌리면 실패 전에 처리한 건을 모두 다시 봐요 (멱등이면 건너뛰어요)', () => {
    const r = simulate({ ...base, restart: 'scratch', crash: true, crashPct: 55 });
    expect(r.resumeFrom).toBe(0);
    expect(r.revisits).toBe(550);
    expect(r.duplicates).toBe(0);
  });
});

describe('멱등 처리를 끄면', () => {
  it('체크포인트부터 이으면 커밋 전 부분(청크 안의 50건)만 중복 정산돼요', () => {
    const r = simulate({ ...base, idempotent: false, restart: 'checkpoint', crash: true, crashPct: 55 });
    expect(r.resumeFrom).toBe(500);
    expect(r.duplicates).toBe(50);
    expect(r.revisits).toBe(50);
    expect(r.missing).toBe(0);
  });

  it('처음부터 다시 돌리면 실패 전 550건이 모두 두 번 정산돼요', () => {
    const r = simulate({ ...base, idempotent: false, restart: 'scratch', crash: true, crashPct: 55 });
    expect(r.duplicates).toBe(550);
  });

  it('두 번째 실행을 잠그지 않으면 같은 건이 여러 번 정산돼요', () => {
    const r = simulate({ ...base, idempotent: false, lock: false, rival: true, crash: false });
    expect(r.duplicates).toBeGreaterThan(0);
    expect(r.rejectedRuns).toBe(0);
  });
});

describe('동시 실행 막기', () => {
  it('잠금을 켜면 두 번째 실행은 거절되고, 멱등을 꺼도 중복이 없어요', () => {
    const r = simulate({ ...base, idempotent: false, lock: true, rival: true, crash: false });
    expect(r.rejectedRuns).toBe(1);
    expect(r.duplicates).toBe(0);
    expect(r.missing).toBe(0);
  });
});

describe('청크 크기와 총 처리 시간', () => {
  it('청크가 작을수록 커밋이 많아서 같은 건수를 처리하는 데 시간이 더 걸려요', () => {
    const small = simulate({ ...base, chunk: 10, crash: false });
    const large = simulate({ ...base, chunk: 100, crash: false });
    expect(small.totalTicks).toBeGreaterThan(large.totalTicks);
  });
});

describe('결정성과 완료 조건', () => {
  it('같은 시드와 설정은 항상 같은 결과를 내요', () => {
    const a = simulate({ ...base, crash: true, crashPct: 40, seed: 11 });
    const b = simulate({ ...base, crash: true, crashPct: 40, seed: 11 });
    expect(b).toEqual(a);
  });

  it('처리 완료 건수는 마지막에 전체 건수와 같아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, idempotent: false, crash: true, crashPct: 70, seed, restart: 'checkpoint' });
      expect(r.doneByTick.at(-1)).toBe(base.total);
      expect(r.doneByTick).toHaveLength(r.totalTicks + 1);
    }
  });

  it('실패가 없으면 재시작 지점과 실패 틱이 없어요', () => {
    const r = simulate({ ...base, crash: false });
    expect(r.resumeFrom).toBeNull();
    expect(r.crashTick).toBeNull();
    expect(r.duplicates).toBe(0);
  });
});
