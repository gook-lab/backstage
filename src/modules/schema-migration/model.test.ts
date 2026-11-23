import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, HORIZON, REQUESTS_PER_TICK, type Params, mixAt, simulate, works } from './model';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

const bigBang: Params = { ...DEFAULT_PARAMS, strategy: 'big-bang' };
const staged: Params = { ...DEFAULT_PARAMS, strategy: 'staged', tail: 0, contractTick: 50 };

describe('응답 모양과 FE 번들의 호환', () => {
  it('옛 번들은 nickname 이 있어야 하고, 새 번들(한 번에)은 displayName 이 있어야 해요', () => {
    expect(works('old', 'old')).toBe(true);
    expect(works('renamed', 'old')).toBe(false);
    expect(works('old', 'strict-new')).toBe(false);
    expect(works('renamed', 'strict-new')).toBe(true);
  });

  it('펼친 응답은 옛 번들과 새 번들을 모두 통과시키고, 기본값으로 읽는 번들은 두 필드 중 하나면 돼요', () => {
    expect(works('both', 'old')).toBe(true);
    expect(works('both', 'strict-new')).toBe(true);
    expect(works('both', 'tolerant-new')).toBe(true);
    expect(works('old', 'tolerant-new')).toBe(true);
    expect(works('renamed', 'tolerant-new')).toBe(true);
  });
});

describe('한 번에 바꾸기', () => {
  it('롤링 중 옛 서버와 새 FE 가 만나거나, 새 서버와 옛 FE 가 만나 요청이 깨져요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...bigBang, seed });
      expect(r.failed).toBeGreaterThan(0);
      expect(r.combos.old.new.failed).toBeGreaterThan(0);
      expect(r.combos.renamed.old.failed).toBeGreaterThan(0);
    }
  });

  it('펼친 응답은 이 방식에서 나오지 않아서 해당 조합 요청이 0 건이에요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...bigBang, seed });
      expect(r.combos.both.old.total).toBe(0);
      expect(r.combos.both.new.total).toBe(0);
    }
  });
});

describe('단계별로 바꾸기', () => {
  it('펼친 뒤 충분히 기다리고 줄이면, 옛 손님이 없을 때만 옛 필드를 빼서 깨지는 요청이 없어요', () => {
    for (const seed of SEEDS) {
      expect(simulate({ ...staged, seed }).failed).toBe(0);
    }
  });

  it('옛 필드를 너무 일찍 빼면, 아직 옛 번들을 쥔 손님이 깨져요', () => {
    for (const seed of SEEDS) {
      const early = simulate({ ...staged, seed, contractTick: 20, tail: 0.05 });
      expect(early.combos.renamed.old.failed).toBeGreaterThan(0);
    }
  });

  it('오래 열린 탭(tail)이 남아 있으면, 충분히 기다린 뒤 줄여도 일부가 깨져요', () => {
    const total = SEEDS.reduce((sum, seed) => sum + simulate({ ...staged, tail: 0.05, seed }).failed, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('결과 합계와 결정성', () => {
  it('요청은 틱 수와 틱당 요청 수만큼 생기고, 조합 합계가 전체와 맞아요', () => {
    for (const p of [bigBang, staged]) {
      const r = simulate(p);
      expect(r.total).toBe(HORIZON * REQUESTS_PER_TICK);
      expect(r.failedByTick).toHaveLength(HORIZON);
      expect(r.failedByTick.reduce((a, b) => a + b, 0)).toBe(r.failed);

      const combos = Object.values(r.combos).flatMap((row) => Object.values(row));
      expect(combos.reduce((a, c) => a + c.total, 0)).toBe(r.total);
      expect(combos.reduce((a, c) => a + c.failed, 0)).toBe(r.failed);
    }
  });

  it('깨진 구간의 처음과 끝 틱은 실제로 깨진 틱과 맞아요', () => {
    const r = simulate(bigBang);
    expect(r.firstFail).toBe(r.failedByTick.findIndex((n) => n > 0));
    expect(r.lastFail).toBe(r.failedByTick.length - 1 - [...r.failedByTick].reverse().findIndex((n) => n > 0));
  });

  it('같은 시드와 같은 조건이면 결과가 같고, 다른 시드면 흐름이 달라져요', () => {
    expect(simulate(bigBang)).toEqual(simulate(bigBang));
    expect(simulate({ ...bigBang, seed: 7 }).failedByTick).not.toEqual(simulate({ ...bigBang, seed: 8 }).failedByTick);
  });
});

describe('시각별 스냅샷', () => {
  it('배포 전에는 전부 옛 서버와 옛 손님이고, 롤링이 끝나면 새 서버만 남아요', () => {
    expect(mixAt(bigBang, 0)).toMatchObject({ old: 1, renamed: 0, oldClient: 1 });
    expect(mixAt(bigBang, HORIZON - 1)).toMatchObject({ old: 0, renamed: 1 });
  });

  it('단계별에서 펼친 응답과 새 응답의 비율은 합이 1 이 돼요', () => {
    for (let t = 0; t < HORIZON; t++) {
      const m = mixAt(staged, t);
      expect(m.old + m.both + m.renamed).toBeCloseTo(1, 10);
    }
  });
});
