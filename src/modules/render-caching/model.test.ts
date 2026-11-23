import { describe, expect, it } from 'vitest';
import {
  BUILD_INTERVAL_SECONDS,
  DAY_SECONDS,
  DEFAULT_SCENARIO,
  formatSeconds,
  hitRate,
  type Scenario,
  simulate,
} from './model';

const base: Scenario = {
  layout: 'shared',
  mode: 'request',
  revalidateSeconds: 60,
  loggedInRatio: 0.3,
  requestsPerSecond: 20,
  changeAtSecond: 13 * 60 * 60,
};

describe('상품 페이지 렌더링 시뮬레이터', () => {
  it('요청마다 렌더링하면 공유 캐시가 답한 요청이 없고, 모든 요청이 원 서버에 가요', () => {
    const r = simulate({ ...base, mode: 'request' });
    expect(r.originRenders).toBe(20 * DAY_SECONDS);
    expect(hitRate(r)).toBe(0);
    expect(r.oldExposureSeconds).toBe(0);
  });

  it('재검증 60초면 하루에 1440번만 렌더링하고, 나머지는 저장본으로 답해요', () => {
    const r = simulate({ ...base, mode: 'revalidate', revalidateSeconds: 60 });
    expect(r.originRenders).toBe(1440);
    expect(hitRate(r)).toBeGreaterThan(0.99);
  });

  it('재검증 간격 안에서 가격이 바뀌면 옛 가격이 간격이 끝날 때까지 나가요', () => {
    // 저장본은 46200초에 만들어져 46800초까지 간다. 변경은 46850초라서 47400초까지 옛 가격이 나가요
    const r = simulate({ ...base, mode: 'revalidate', revalidateSeconds: 600, changeAtSecond: 46850 });
    expect(r.oldExposureSeconds).toBe(550);
    expect(r.oldServed).toBeGreaterThan(0);
  });

  it('빌드 시 렌더링하면 하루 4번만 만들고, 다음 배포 전까지 옛 가격이 나가요', () => {
    const r = simulate({ ...base, mode: 'build', requestsPerSecond: 5, changeAtSecond: 9 * 60 * 60 });
    expect(r.originRenders).toBe(DAY_SECONDS / BUILD_INTERVAL_SECONDS);
    expect(r.oldExposureSeconds).toBe(12 * 60 * 60 - 9 * 60 * 60);
  });

  it('섞인 페이지는 로그인 요청이 공유 캐시를 건너뛰어 원 서버 렌더링이 크게 늘어요', () => {
    const shared = simulate({ ...base, mode: 'revalidate', layout: 'shared' });
    const mixed = simulate({ ...base, mode: 'revalidate', layout: 'mixed' });
    expect(mixed.originRenders).toBe(1440 + 20 * 0.3 * DAY_SECONDS);
    expect(mixed.originRenders).toBeGreaterThan(shared.originRenders);
    expect(hitRate(mixed)).toBeCloseTo(0.7, 2);
  });

  it('로그인 사용자가 없으면 섞인 페이지와 공용 페이지의 결과가 같아요', () => {
    const mixed = simulate({ ...base, mode: 'revalidate', layout: 'mixed', loggedInRatio: 0 });
    const shared = simulate({ ...base, mode: 'revalidate', layout: 'shared', loggedInRatio: 0 });
    expect(mixed).toEqual(shared);
  });

  it('공용 HTML 과 개인 부분을 나누면 공용 렌더링은 공용 페이지와 같고, 개인 부분만 원 서버를 따로 불러요', () => {
    const shared = simulate({ ...base, mode: 'revalidate', layout: 'shared' });
    const split = simulate({ ...base, mode: 'revalidate', layout: 'split' });
    expect(split.originRenders).toBe(shared.originRenders);
    expect(split.personalCalls).toBe(20 * 0.3 * DAY_SECONDS);
    expect(hitRate(split)).toBeGreaterThan(0.99);
  });

  it('기본 시나리오도 계산이 끝나고 요청 수가 하루치와 같아요', () => {
    const r = simulate(DEFAULT_SCENARIO);
    expect(r.pageRequests).toBe(DEFAULT_SCENARIO.requestsPerSecond * DAY_SECONDS);
  });

  it('시간 표기는 짧게 바꿔 줘요', () => {
    expect(formatSeconds(0)).toBe('0초');
    expect(formatSeconds(45)).toBe('45초');
    expect(formatSeconds(600)).toBe('10분');
    expect(formatSeconds(3600)).toBe('1시간');
    expect(formatSeconds(11100)).toBe('3시간 5분');
  });
});
