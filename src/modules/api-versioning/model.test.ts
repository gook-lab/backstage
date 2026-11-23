import { describe, expect, it } from 'vitest';
import { MAX_DAY, PLATFORMS, POLICIES, platformOutcomes, policyById, snapshot, type Outcome } from './model';

const web = PLATFORMS[0];
const ios = PLATFORMS[1];
const android = PLATFORMS[2];

const sumOf = (o: Record<Outcome, number>) => o.ok + o.warned + o.gated + o.blocked;

describe('플랫폼별 결과 비율', () => {
  it('모든 날짜와 정책에서 결과 비율의 합은 1이다', () => {
    for (const policy of POLICIES) {
      for (let day = 0; day <= MAX_DAY; day++) {
        for (const p of PLATFORMS) {
          expect(sumOf(platformOutcomes(p, day, policy))).toBeCloseTo(1, 9);
        }
      }
    }
  });

  it('알림만 고르면 어느 날에도 차단이나 게이트가 생기지 않는다', () => {
    const notice = policyById('notice');
    for (let day = 0; day <= MAX_DAY; day++) {
      const total = snapshot(day, notice).total;
      expect(total.blocked).toBe(0);
      expect(total.gated).toBe(0);
    }
  });

  it('옛 버전 비율은 시간이 갈수록 줄어들거나 그대로다', () => {
    const notice = policyById('notice');
    let prev = Infinity;
    for (let day = 0; day <= MAX_DAY; day++) {
      const { oldShare } = snapshot(day, notice);
      expect(oldShare).toBeLessThanOrEqual(prev + 1e-12);
      prev = oldShare;
    }
  });
});

describe('폐기 날짜에 차단', () => {
  const sunset = policyById('sunset');

  it('Sunset 날짜 전에는 차단 응답이 없고, 날짜가 지나면 열어 둔 탭이 차단된다', () => {
    expect(platformOutcomes(web, 89, sunset).blocked).toBe(0);
    expect(platformOutcomes(web, 90, sunset).blocked).toBeGreaterThan(0);
  });

  it('공지 뒤 Sunset 전에는 옛 버전이 경고 헤더를 받는다', () => {
    expect(platformOutcomes(ios, 60, sunset).warned).toBeGreaterThan(0);
    expect(platformOutcomes(ios, 60, sunset).blocked).toBe(0);
  });
});

describe('최소 버전 강제 업데이트', () => {
  const force = policyById('force');

  it('발효 날짜부터 앱에는 업데이트 화면이 나오고, 웹에는 나오지 않는다', () => {
    expect(platformOutcomes(ios, 22, force).gated).toBeGreaterThan(0);
    expect(platformOutcomes(android, 22, force).gated).toBeGreaterThan(0);
    expect(platformOutcomes(web, 22, force).gated).toBe(0);
  });

  it('업데이트가 끝난 뒤에도 앱을 열지 않은 기기는 업데이트 화면이 아니라 차단으로 남는다', () => {
    const late = platformOutcomes(ios, 100, force);
    expect(late.gated).toBe(0);
    expect(late.blocked).toBeCloseTo(ios.stuck, 9);
  });
});

describe('폐기 날짜를 짧게 잡으면', () => {
  it('같은 날짜에 기본 Sunset 정책보다 더 많은 요청이 차단된다', () => {
    const early = snapshot(45, policyById('early')).total.blocked;
    const sunset = snapshot(45, policyById('sunset')).total.blocked;
    expect(early).toBeGreaterThan(0);
    expect(sunset).toBe(0);
  });

  it('짧은 Sunset 날짜에는 업데이트 중이던 Android 앱 기기도 차단된다', () => {
    const early = platformOutcomes(android, 40, policyById('early')).blocked;
    expect(early).toBeGreaterThan(android.stuck);
  });
});
