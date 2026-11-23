import { describe, expect, it } from 'vitest';
import { effectivePartMiB, minPartMiB, simulate } from './model';

const GiB = 1024;
const base = { fileMiB: 10 * GiB, partMiB: 16, dropPer100MiB: 0.1, seed: 7 };

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('업로드 시뮬레이션', () => {
  it('끊김이 없으면 두 방식 모두 파일 크기만큼만 보내고 버리는 양은 0 이에요', () => {
    const { single, multipart } = simulate({ ...base, dropPer100MiB: 0, fileMiB: GiB });

    expect(single).toMatchObject({ completed: true, sentMiB: GiB, wastedMiB: 0, attempts: 1 });
    expect(multipart).toMatchObject({ completed: true, sentMiB: GiB, wastedMiB: 0, parts: 64, attempts: 64 });
  });

  it('같은 시드와 같은 입력이면 항상 같은 결과가 나와요', () => {
    expect(simulate(base)).toEqual(simulate(base));
  });

  it('10 GiB 를 끊김 10% 환경에서 올리면 단일 업로드는 끝내지 못하고 멀티파트는 끝나요', () => {
    const { single, multipart } = simulate(base);

    expect(single.completed).toBe(false);
    expect(multipart.completed).toBe(true);
  });

  it('멀티파트가 버리는 양은 실패한 시도 수에 조각 크기를 곱한 값을 넘지 않아요', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const { multipart } = simulate({ ...base, seed });
      const failedAttempts = multipart.attempts - multipart.parts;

      expect(multipart.wastedMiB).toBeLessThanOrEqual(failedAttempts * 16 + 1e-9);
    }
  });

  it('큰 파일일수록 단일 업로드가 끊김 때문에 버리는 양이 멀티파트보다 커요', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    const singleWaste = seeds.map((seed) => simulate({ ...base, seed }).single.wastedMiB);
    const multipartWaste = seeds.map((seed) => simulate({ ...base, seed }).multipart.wastedMiB);

    expect(mean(singleWaste)).toBeGreaterThan(mean(multipartWaste));
  });

  it('조각 수는 10,000 개를 넘지 않도록 조각 크기가 자동으로 커져요', () => {
    const oneTiB = 1024 * 1024;
    const { multipart } = simulate({ ...base, fileMiB: oneTiB, partMiB: 5, dropPer100MiB: 0 });

    expect(minPartMiB(oneTiB)).toBe(105);
    expect(effectivePartMiB(10 * GiB, 1)).toBe(5);
    expect(multipart.parts).toBeLessThanOrEqual(10000);
  });
});
