import { describe, expect, it } from 'vitest';
import { type Params, summarize } from './model';

const base: Params = {
  lift: 0.2,
  visitorsPerDay: 500,
  reach: 0.5,
  judge: 'fixed',
  record: 'expose',
  seed: 7,
};

describe('A/B 실험 결과 판정 모델', () => {
  it('같은 시드와 같은 설정이면 같은 결과가 나와요', () => {
    const a = summarize(base, 50);
    const b = summarize(base, 50);
    expect(a).toEqual(b);
  });

  it('실제 노출 시 기록하면 설정한 효과를 평균적으로 되찾아요', () => {
    const s = summarize({ ...base, record: 'expose' }, 300);
    expect(s.measuredLiftAvg).toBeGreaterThan(0.18);
    expect(s.measuredLiftAvg).toBeLessThan(0.22);
  });

  it('배정 시 기록하면 버튼을 못 본 방문자가 섞여 효과가 노출 비율만큼 줄어요', () => {
    const s = summarize({ ...base, record: 'assign', reach: 0.5 }, 300);
    expect(s.measuredLiftAvg).toBeGreaterThan(0.08);
    expect(s.measuredLiftAvg).toBeLessThan(0.12);
  });

  it('효과가 없을 때 매일 보고 멈추면 고정 기간보다 잘못 찾아내는 비율이 높아요', () => {
    const fixed = summarize({ ...base, lift: 0, judge: 'fixed' }, 300);
    const daily = summarize({ ...base, lift: 0, judge: 'daily' }, 300);
    expect(fixed.significantRate).toBeLessThan(0.1);
    expect(daily.significantRate).toBeGreaterThan(fixed.significantRate + 0.05);
  });

  it('효과가 있어도 유의하게 나온 실험의 측정 효과는 설정보다 크게 나올 수 있어요', () => {
    const s = summarize({ ...base, lift: 0.05, visitorsPerDay: 100, judge: 'fixed' }, 300);
    expect(s.significantLiftAvg).not.toBeNull();
    expect(s.significantLiftAvg as number).toBeGreaterThan(s.measuredLiftAvg);
  });
});
