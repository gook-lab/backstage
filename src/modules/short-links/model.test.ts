import { describe, expect, it } from 'vitest';
import { codeLength, codeSpace, collisionProbability, encodeBase62, guessOutcome, staleAfterChange } from './model';

/** 시드 고정 LCG. 테스트마다 같은 난수열을 써요. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('base62 인코딩', () => {
  it('0, 9, 10, 61, 62 를 기대한 코드로 바꿔요', () => {
    expect(encodeBase62(0)).toBe('0');
    expect(encodeBase62(9)).toBe('9');
    expect(encodeBase62(10)).toBe('A');
    expect(encodeBase62(61)).toBe('z');
    expect(encodeBase62(62)).toBe('10');
  });

  it('음수와 정수가 아닌 값은 거부해요', () => {
    expect(() => encodeBase62(-1)).toThrow(RangeError);
    expect(() => encodeBase62(1.5)).toThrow(RangeError);
  });
});

describe('코드 길이와 경우의 수', () => {
  it('순번 방식은 링크 수가 62를 넘는 순간 2자가 돼요', () => {
    expect(codeLength('seq', 1)).toBe(1);
    expect(codeLength('seq', 62)).toBe(1);
    expect(codeLength('seq', 63)).toBe(2);
    expect(codeLength('seq', 1_000_000)).toBe(4);
  });

  it('무작위 방식은 링크 수와 무관하게 고정 길이예요', () => {
    expect(codeLength('rand6', 1_000_000_000)).toBe(6);
    expect(codeLength('rand8', 1)).toBe(8);
  });

  it('6자는 62^6 개의 경우가 있어요', () => {
    expect(codeSpace(6)).toBe(56_800_235_584);
  });
});

describe('충돌 확률 (생일 문제 근사)', () => {
  it('순번 방식은 충돌이 없어요', () => {
    expect(collisionProbability('seq', 1_000_000)).toBe(0);
  });

  it('생일 문제 정확값(365일에 23명 → 약 0.507)과 근사가 0.01 안에서 맞아요', () => {
    // 정확값: 1 - (365 · 364 · … · 343) / 365^23
    let exact = 1;
    for (let k = 0; k < 23; k += 1) exact *= (365 - k) / 365;
    const approx = -Math.expm1(-(23 * 22) / (2 * 365));
    expect(Math.abs(approx - (1 - exact))).toBeLessThan(0.01);
  });

  it('작은 공간에서 시뮬레이션한 충돌 비율이 근사와 0.05 안에서 맞아요', () => {
    // N = 1000 공간에 코드 50개를 무작위로 넣고 한 쌍이라도 겹친 시행 비율을 센다.
    const N = 1000;
    const n = 50;
    const trials = 2000;
    const rand = lcg(42);
    let collided = 0;
    for (let t = 0; t < trials; t += 1) {
      const seen = new Set<number>();
      let hit = false;
      for (let i = 0; i < n; i += 1) {
        const v = Math.floor(rand() * N);
        if (seen.has(v)) {
          hit = true;
          break;
        }
        seen.add(v);
      }
      if (hit) collided += 1;
    }
    const observed = collided / trials;
    const approx = -Math.expm1(-(n * (n - 1)) / (2 * N));
    expect(Math.abs(observed - approx)).toBeLessThan(0.05);
  });

  it('같은 링크 수에서 8자는 6자보다 충돌 확률이 낮아요', () => {
    expect(collisionProbability('rand8', 1_000_000)).toBeLessThan(collisionProbability('rand6', 1_000_000));
  });
});

describe('추측 결과', () => {
  it('순번 방식은 앞에서부터 나열하면 g번 중 min(g, n) 개를 찾아요', () => {
    expect(guessOutcome('seq', 1000, 100).expectedHits).toBe(100);
    expect(guessOutcome('seq', 10, 100).expectedHits).toBe(10);
    expect(guessOutcome('seq', 10, 100).probAtLeastOne).toBe(1);
  });

  it('무작위 6자에서 링크 100만 개면 추측 한 번에 맞힐 확률은 약 0.00176% 예요', () => {
    const g = guessOutcome('rand6', 1_000_000, 1);
    expect(g.hitRate).toBeCloseTo(1_000_000 / 56_800_235_584, 12);
    expect(g.expectedHits).toBeCloseTo(g.hitRate, 12);
  });

  it('무작위 추측 1만 번이면 한 개 이상 찾을 확률이 커져요', () => {
    const small = guessOutcome('rand8', 1_000_000, 1000).probAtLeastOne;
    const big = guessOutcome('rand8', 1_000_000, 10_000).probAtLeastOne;
    expect(big).toBeGreaterThan(small);
    expect(guessOutcome('rand6', 1_000_000, 0).probAtLeastOne).toBe(0);
  });
});

describe('대상 변경 뒤 옛 주소 (재방문자 기준)', () => {
  it('헤더가 없을 때 301 과 308 은 저장되어 옛 주소로 갈 수 있어요', () => {
    expect(staleAfterChange(301, 'none')).toBe(true);
    expect(staleAfterChange(308, 'none')).toBe(true);
  });

  it('헤더가 없을 때 302 와 307 은 저장되지 않아요', () => {
    expect(staleAfterChange(302, 'none')).toBe(false);
    expect(staleAfterChange(307, 'none')).toBe(false);
  });

  it('max-age 가 있으면 상태 코드와 상관없이 기간 동안 옛 주소예요', () => {
    expect(staleAfterChange(302, 'max-age')).toBe(true);
    expect(staleAfterChange(307, 'max-age')).toBe(true);
  });

  it('no-store 는 상태 코드와 상관없이 저장하지 않아요', () => {
    expect(staleAfterChange(301, 'no-store')).toBe(false);
    expect(staleAfterChange(308, 'no-store')).toBe(false);
  });
});
