import { type LimiterConfig, buildPattern, maxAllowedInWindow, promisedMax, runLimiter, runSpike } from './model';

const base = { limit: 5, windowMs: 1000, refillPerSec: 5 };
const cfg = (algorithm: LimiterConfig['algorithm'], over: Partial<LimiterConfig> = {}): LimiterConfig => ({
  ...base,
  algorithm,
  ...over,
});
const allowedCount = (times: number[], c: LimiterConfig) => runLimiter(times, c).filter((d) => d.allowed).length;

describe('트래픽 몰림 — 보호 없음과 대기실', () => {
  it('보호 없이 N 이 C 를 넘으면 실패와 재시도가 생기고 일부는 포기한다', () => {
    const r = runSpike({ users: 1000, capacity: 100, admitPerTick: null });
    expect(r.ticks[0].load).toBe(1000);
    expect(r.ticks[1].load).toBe(900);
    expect(r.succeeded).toBe(300);
    expect(r.gaveUp).toBe(700);
    expect(r.totalRequests).toBe(2700);
  });

  it('보호 없이 N 이 C 이하이면 실패가 없다', () => {
    const r = runSpike({ users: 80, capacity: 100, admitPerTick: null });
    expect(r.gaveUp).toBe(0);
    expect(r.succeeded).toBe(80);
    expect(r.avgWait).toBe(0);
  });

  it('대기실이 입장 속도를 C 이하로 두면 백엔드 부하가 C 를 넘지 않고 모두 성공한다', () => {
    const r = runSpike({ users: 1000, capacity: 100, admitPerTick: 100 });
    expect(r.peakLoad).toBeLessThanOrEqual(100);
    expect(r.gaveUp).toBe(0);
    expect(r.succeeded).toBe(1000);
    expect(r.ticks.every((t) => t.failed === 0)).toBe(true);
  });

  it('대기실 입장 속도가 C 를 넘기면 입장자가 실패해 재시도가 붙는다', () => {
    const r = runSpike({ users: 1000, capacity: 100, admitPerTick: 150 });
    expect(r.peakLoad).toBeGreaterThan(100);
    expect(r.ticks[0].failed).toBe(50);
  });

  it('대기실에서는 뒤 사람일수록 기다린 틱이 늘어난다', () => {
    const r = runSpike({ users: 1000, capacity: 100, admitPerTick: 100 });
    expect(r.avgWait).toBeCloseTo(4.5);
    expect(r.ticks[0].waiting).toBe(900);
  });
});

describe('토큰 버킷', () => {
  it('같은 순간에 몰린 요청은 burst 개만 통과한다', () => {
    const times = Array.from({ length: 20 }, () => 0);
    expect(allowedCount(times, cfg('token'))).toBe(5);
  });

  it('긴 흐름에서도 허용 수는 burst 와 보충량의 합을 넘지 않는다', () => {
    const dense = Array.from({ length: 2000 }, (_, i) => i * 3);
    const span = dense[dense.length - 1];
    expect(allowedCount(dense, cfg('token'))).toBeLessThanOrEqual(5 + (5 * span) / 1000);
    expect(allowedCount(buildPattern('burst', { limit: 5, windowMs: 1000 }), cfg('token'))).toBe(5);
  });

  it('어떤 창 길이에서도 약속한 상한을 넘지 않는다', () => {
    const times = buildPattern('edge', { limit: 5, windowMs: 1000 });
    const decisions = runLimiter(times, cfg('token'));
    expect(maxAllowedInWindow(decisions, 1000)).toBeLessThanOrEqual(promisedMax(cfg('token')));
  });
});

describe('창 기반 제한 — 경계 버스트', () => {
  it('고정 창은 창 경계에서 한도의 두 배가 통과한다', () => {
    const times = buildPattern('edge', { limit: 5, windowMs: 1000 });
    const decisions = runLimiter(times, cfg('fixed'));
    expect(maxAllowedInWindow(decisions, 1000)).toBe(10);
    expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
  });

  it('슬라이딩 로그는 같은 패턴에서도 한 창에 한도를 넘기지 않는다', () => {
    const times = buildPattern('edge', { limit: 5, windowMs: 1000 });
    const decisions = runLimiter(times, cfg('sliding'));
    expect(maxAllowedInWindow(decisions, 1000)).toBe(5);
    expect(decisions.filter((d) => !d.allowed).length).toBeGreaterThan(0);
  });

  it('정상 속도의 요청은 세 알고리즘 모두 통과한다', () => {
    const times = buildPattern('steady', { limit: 5, windowMs: 1000 });
    for (const algorithm of ['fixed', 'sliding', 'token'] as const) {
      expect(allowedCount(times, cfg(algorithm))).toBe(times.length);
    }
  });
});

describe('패턴 생성', () => {
  it('같은 입력이면 같은 요청 시각을 만든다', () => {
    expect(buildPattern('edge', { limit: 3, windowMs: 1000 })).toEqual([970, 980, 990, 1000, 1010, 1020]);
  });
});
