import { describe, expect, it } from 'vitest';
import { DEPLOY_AT, NEW_SERVER_READY_AFTER, type Params, PRESETS, simulate } from './model';

const preset = (id: string): Params => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`preset ${id} 없음`);
  return found.params;
};

describe('배포 한 번의 응답 결과', () => {
  it('요청 수는 시간 축 길이와 0.5초 간격으로 정해지고, 상태 합계와 맞아요', () => {
    const t = simulate(preset('default'));
    expect(t.shots).toHaveLength(180);
    expect(t.counts[200] + t.counts[502] + t.counts[503]).toBe(180);
  });

  it('기본 설정은 502 없이 종료 중인 서버의 503만 보여 줘요', () => {
    const t = simulate(preset('default'));
    expect(t.counts[502]).toBe(0);
    expect(t.counts[503]).toBeGreaterThan(0);
  });

  it('종료 신호 전 대기가 헬스 체크 감지 시간 이상이면 배포 중 실패 응답이 없어요', () => {
    const t = simulate(preset('prestop'));
    expect(t.counts[502]).toBe(0);
    expect(t.counts[503]).toBe(0);
  });

  it('바로 종료하면 503 대신 502가 나와요', () => {
    const t = simulate(preset('kill'));
    expect(t.counts[503]).toBe(0);
    expect(t.counts[502]).toBeGreaterThan(0);
  });

  it('긴 요청에 드레이닝이 짧으면 처리 중이던 요청이 드레이닝 시간이 끝나며 502로 끊겨요', () => {
    const t = simulate(preset('long-request'));
    expect(t.counts[502]).toBeGreaterThan(0);
    expect(t.shots.some((s) => s.status === 502 && s.reason.includes('드레이닝'))).toBe(true);
  });

  it('같은 긴 요청이라도 드레이닝이 충분하면 끊기는 요청이 없어요', () => {
    const t = simulate({ ...preset('long-request'), drainSec: 30 });
    expect(t.counts[502]).toBe(0);
  });
});

describe('로드밸런서 목록과 새 서버', () => {
  it('새 서버는 준비가 끝난 뒤에만 요청을 받아요', () => {
    const t = simulate(preset('default'));
    const newLane = t.lanes.length - 1;
    const early = t.shots.filter((s) => s.lane === newLane && s.at < DEPLOY_AT + NEW_SERVER_READY_AFTER);
    expect(early).toHaveLength(0);
    expect(t.shots.some((s) => s.lane === newLane)).toBe(true);
  });

  it('교체 대상이 아닌 서버로 가는 요청은 실패하지 않아요', () => {
    const t = simulate(preset('kill'));
    const others = t.shots.filter((s) => !t.lanes[s.lane].replaced);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((s) => s.status === 200)).toBe(true);
  });

  it('감지 시간은 간격과 연속 실패 횟수로 정해져요', () => {
    const t = simulate(preset('default'));
    expect(t.noticeAt).toBe(DEPLOY_AT + 2 * 10);
  });
});
