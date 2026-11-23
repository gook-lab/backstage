import {
  type Algorithm,
  type LimiterConfig,
  type Topology,
  buildPattern,
  estimateSlidingCounter,
  maxServedInWindow,
  promisedMax,
  runLimiter,
  runTopology,
} from './model';

const cfg = (algorithm: Algorithm, over: Partial<LimiterConfig> = {}): LimiterConfig => ({
  algorithm,
  limit: 5,
  windowMs: 1000,
  refillPerSec: 5,
  ...over,
});

const edge = () => buildPattern('edge', { limit: 5, windowMs: 1000, seed: 1 });
const allowedOf = (times: number[], c: LimiterConfig, t: Topology = 'single') =>
  runTopology(times, c, t).filter((d) => d.allowed).length;
const servedMax = (times: number[], c: LimiterConfig, t: Topology = 'single') =>
  maxServedInWindow(runTopology(times, c, t), c.windowMs);

describe('창 경계 — 같은 요청 10개를 알고리즘마다 통과시키면', () => {
  it('고정 창은 경계 양쪽에서 각각 한도만큼 통과해 1초 안에 한도의 두 배가 처리된다', () => {
    expect(allowedOf(edge(), cfg('fixed'))).toBe(10);
    expect(servedMax(edge(), cfg('fixed'))).toBe(10);
    expect(promisedMax(cfg('fixed'))).toBe(5);
  });

  it('슬라이딩 로그는 최근 1초 안의 개수를 세서 5개만 통과한다', () => {
    expect(allowedOf(edge(), cfg('log'))).toBe(5);
    expect(servedMax(edge(), cfg('log'))).toBe(5);
  });

  it('슬라이딩 카운터는 추정이라 한도를 1개 넘는 6개가 1초 안에 통과한다', () => {
    expect(allowedOf(edge(), cfg('counter'))).toBe(6);
    expect(servedMax(edge(), cfg('counter'))).toBe(6);
  });

  it('토큰 버킷은 버킷 용량 5개만 쓰고, 나머지는 보충이 쌓일 때까지 거절한다', () => {
    expect(allowedOf(edge(), cfg('token'))).toBe(5);
  });

  it('누수 버킷은 통과한 요청도 처리 시각이 밀려 1초 안 처리량이 5개를 넘지 않는다', () => {
    const decisions = runLimiter(edge(), cfg('leaky'));
    expect(decisions.filter((d) => d.allowed).length).toBe(6);
    expect(maxServedInWindow(decisions, 1000)).toBe(5);
    const delayed = decisions.filter((d) => d.allowed && d.servedAtMs > d.atMs);
    expect(delayed.length).toBeGreaterThan(0);
  });
});

describe('추정식 — 슬라이딩 카운터의 계산', () => {
  it('이전 창 42개, 현재 창 18개, 현재 창 15초 경과 한 분 창이면 49.5 로 추정한다', () => {
    expect(estimateSlidingCounter(42, 18, 15 / 60)).toBeCloseTo(49.5);
  });
});

describe('서버 구성 — 카운터를 나누면 한도가 늘어난다', () => {
  const steady = buildPattern('steady', { limit: 5, windowMs: 1000, seed: 1 });

  it('고른 흐름(1.5배)은 서버 1대에서 한도 5개만 통과한다', () => {
    expect(servedMax(steady, cfg('fixed'))).toBe(5);
    expect(allowedOf(steady, cfg('fixed'))).toBe(15);
  });

  it('서버 2대가 각자 카운터를 가지면 같은 흐름이 전부 통과해 1초 처리량이 8개가 된다', () => {
    expect(allowedOf(steady, cfg('fixed'), 'two-local')).toBe(24);
    expect(servedMax(steady, cfg('fixed'), 'two-local')).toBe(8);
  });

  it('공유 카운터를 쓰면 서버가 여럿이어도 단일 서버와 같은 결과가 나온다', () => {
    expect(runTopology(steady, cfg('fixed'), 'two-shared')).toEqual(runTopology(steady, cfg('fixed'), 'single'));
  });

  it('순간 폭주에서 서버 2대의 각자 카운터는 1초 안에 한도의 두 배를 통과시킨다', () => {
    const burst = buildPattern('burst', { limit: 5, windowMs: 1000, seed: 1 });
    expect(allowedOf(burst, cfg('fixed'))).toBe(5);
    expect(allowedOf(burst, cfg('fixed'), 'two-local')).toBe(10);
  });
});

describe('무작위 도착 — 시드가 같으면 같은 결과를 낸다', () => {
  it('같은 시드는 같은 도착 시각을 만든다', () => {
    const a = buildPattern('random', { limit: 5, windowMs: 1000, seed: 3 });
    const b = buildPattern('random', { limit: 5, windowMs: 1000, seed: 3 });
    expect(a).toEqual(b);
  });

  it('다른 시드는 다른 도착 시각을 만든다', () => {
    const a = buildPattern('random', { limit: 5, windowMs: 1000, seed: 3 });
    const c = buildPattern('random', { limit: 5, windowMs: 1000, seed: 4 });
    expect(a).not.toEqual(c);
  });

  it('누수 버킷은 어떤 패턴에서도 1초 처리량이 한도를 넘지 않는다', () => {
    for (const pattern of ['steady', 'edge', 'burst', 'random'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const times = buildPattern(pattern, { limit: 5, windowMs: 1000, seed });
        expect(servedMax(times, cfg('leaky'))).toBeLessThanOrEqual(5);
      }
    }
  });
});
