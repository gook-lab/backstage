import { type RealtimeConfig, simulate } from './model';

const base: RealtimeConfig = {
  clients: 10,
  eventsPerMin: 60,
  pollSec: 10,
  dropOn: false,
  resume: true,
  seed: 7,
};
const run = (strategy: Parameters<typeof simulate>[0], over: Partial<RealtimeConfig> = {}) =>
  simulate(strategy, { ...base, ...over });

describe('짧은 폴링', () => {
  it('평균 지연은 간격 P 의 절반 근처에 머문다', () => {
    const r = run('short');
    expect(r.avgDelayMs).toBeGreaterThan(4_000);
    expect(r.avgDelayMs).toBeLessThan(6_000);
  });

  it('요청은 클라이언트마다 간격대로 나가서 분당 N 곱하기 60 / P 에 가깝다', () => {
    const r = run('short');
    expect(r.requestsPerMin).toBeGreaterThanOrEqual(59);
    expect(r.requestsPerMin).toBeLessThanOrEqual(62);
  });

  it('이벤트가 드물면 대부분의 응답이 빈 응답이다', () => {
    const r = run('short', { eventsPerMin: 6, pollSec: 5 });
    expect(r.emptyRatio).toBeGreaterThan(0.9);
  });

  it('드롭이 끝난 뒤에도 커서 덕분에 이벤트를 잃지 않는다', () => {
    const r = run('short', { dropOn: true, resume: false });
    expect(r.missed).toBe(0);
  });
});

describe('서버 푸시 방식', () => {
  it('SSE 와 WebSocket 은 지연이 0 이고 연결은 클라이언트 수만큼 열린다', () => {
    for (const strategy of ['sse', 'ws'] as const) {
      const r = run(strategy);
      expect(r.avgDelayMs).toBe(0);
      expect(r.openConnections).toBe(10);
      expect(r.emptyResponses).toBe(0);
    }
  });

  it('롱 폴링은 이벤트가 없어도 30초마다 빈 응답을 돌려준다', () => {
    const r = run('long', { clients: 1, eventsPerMin: 0 });
    expect(r.emptyResponses).toBe(20);
    expect(r.avgDelayMs).toBeNull();
  });

  it('재개 없이 다시 연결하면 드롭 구간의 이벤트가 사라진다', () => {
    for (const strategy of ['long', 'sse', 'ws'] as const) {
      const r = run(strategy, { dropOn: true, resume: false });
      expect(r.missed).toBeGreaterThan(0);
    }
  });

  it('재개를 켜면 드롭 구간의 이벤트를 하나도 잃지 않는다', () => {
    for (const strategy of ['long', 'sse', 'ws'] as const) {
      const r = run(strategy, { dropOn: true, resume: true });
      expect(r.missed).toBe(0);
    }
  });
});

describe('결정성', () => {
  it('같은 시드는 같은 결과를, 다른 시드는 다른 흐름을 만든다', () => {
    expect(run('short', { dropOn: true })).toEqual(run('short', { dropOn: true }));
    expect(run('short', { seed: 1 }).emptyResponses).not.toBe(run('short', { seed: 2 }).emptyResponses);
  });
});
