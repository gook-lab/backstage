import { describe, expect, it } from 'vitest';
import { brokenSteps, DEFAULT_OPTIONS, newShareAt, type Options, simulate } from './model';

const at = (results: ReturnType<typeof simulate>, step: number) => results[step];

describe('칸별 새 버전 비율', () => {
  it('롤링은 칸마다 25%씩 늘고 칸 4에서 전부 새 버전이 돼요', () => {
    expect([1, 2, 3, 4].map((s) => newShareAt('rolling', s))).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('블루-그린은 칸 2에서 한 번에 바뀌고, 카나리는 칸 1~3에 10%만 보내요', () => {
    expect(newShareAt('blueGreen', 1)).toBe(0);
    expect(newShareAt('blueGreen', 2)).toBe(1);
    expect([1, 2, 3].map((s) => newShareAt('canary', s))).toEqual([0.1, 0.1, 0.1]);
    expect(newShareAt('canary', 4)).toBe(1);
  });

  it('배포 전인 칸 0에는 어떤 방식이든 새 버전이 없어요', () => {
    for (const s of ['rolling', 'blueGreen', 'canary'] as const) expect(newShareAt(s, 0)).toBe(0);
  });
});

describe('옛 탭 요청 결과', () => {
  it('기본값인 롤링 · 바로 삭제 · 해시 파일 미보존은 칸 1에서 필드 누락 15%, 청크 404 10%가 나와요', () => {
    const step1 = at(simulate(DEFAULT_OPTIONS), 1);
    expect(step1).toMatchObject({ ok: 75, missing: 15, chunk404: 10 });
  });

  it('배포 전 칸은 모두 성공이에요', () => {
    expect(at(simulate(DEFAULT_OPTIONS), 0)).toMatchObject({ ok: 100, missing: 0, chunk404: 0 });
  });

  it('블루-그린은 칸 1까지 깨지지 않고, 칸 2부터 전환된 요청이 모두 새 버전으로 가요', () => {
    const options: Options = { ...DEFAULT_OPTIONS, strategy: 'blueGreen' };
    const results = simulate(options);
    expect(at(results, 1)).toMatchObject({ ok: 100 });
    expect(at(results, 2)).toMatchObject({ missing: 60, chunk404: 40, ok: 0 });
  });

  it('카나리는 칸 1~3에 깨짐이 10% 비율만큼만 나와요', () => {
    const options: Options = { ...DEFAULT_OPTIONS, strategy: 'canary' };
    for (const step of [1, 2, 3]) {
      expect(at(simulate(options), step)).toMatchObject({ missing: 6, chunk404: 4 });
    }
    expect(at(simulate(options), 4)).toMatchObject({ missing: 60, chunk404: 40 });
  });

  it('옛 해시 파일을 남기면 청크 404가 한 칸도 나오지 않아요', () => {
    const results = simulate({ ...DEFAULT_OPTIONS, keepAssets: true });
    expect(results.every((r) => r.chunk404 === 0)).toBe(true);
  });

  it('필드를 확장 후 축소로 나누면 이번 배포 창 안에서 필드 누락이 나오지 않아요', () => {
    const results = simulate({ ...DEFAULT_OPTIONS, apiChange: 'expandContract' });
    expect(results.every((r) => r.missing === 0)).toBe(true);
    expect(results.some((r) => r.chunk404 > 0)).toBe(true);
  });

  it('확장 후 축소에 해시 파일을 남기면 어떤 칸에서도 깨진 요청이 없어요', () => {
    const results = simulate({ strategy: 'rolling', keepAssets: true, apiChange: 'expandContract' });
    expect(brokenSteps(results)).toBe(0);
  });

  it('모든 칸에서 성공 · 누락 · 404 비율의 합은 100이에요', () => {
    for (const strategy of ['rolling', 'blueGreen', 'canary'] as const)
      for (const keepAssets of [true, false])
        for (const apiChange of ['immediate', 'expandContract'] as const)
          for (const r of simulate({ strategy, keepAssets, apiChange })) {
            expect(r.ok + r.missing + r.chunk404).toBe(100);
          }
  });
});
