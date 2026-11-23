import { type PoolScenario, layerWarnings, simulate } from './model';

/** 쿼리가 빠르고 시간 제한이 넉넉한 기준 설정. 1초에 1건씩 20초 동안 보내요 */
const base: PoolScenario = {
  rps: 1,
  poolSize: 5,
  avgQueryMs: 100,
  slowRatio: 0,
  slowQueryMs: 3000,
  clientTimeoutMs: 30_000,
  proxyTimeoutMs: 30_000,
  dbTimeoutMs: 30_000,
  retries: 0,
  cancelOnGiveUp: false,
};

/** 모든 쿼리가 6초가 걸리는 설정. 앞단 시간 제한을 바꿔 가며 쓰려고 덮어쓸 수 있게 했어요 */
const slowAll = (over: Partial<PoolScenario> = {}): PoolScenario => ({
  ...base,
  slowRatio: 1,
  avgQueryMs: 6000,
  slowQueryMs: 6000,
  clientTimeoutMs: 2000,
  proxyTimeoutMs: 5000,
  ...over,
});

describe('정상 부하 — 쿼리가 빨리 끝나면', () => {
  it('모든 요청이 정상 응답을 받고 대기열은 비어 있어요', () => {
    const r = simulate(base);
    expect(r.requests).toBe(20);
    expect(r.ok).toBe(20);
    expect(r.gateway504).toBe(0);
    expect(r.clientTimeouts).toBe(0);
    expect(r.maxQueue).toBe(0);
    expect(r.abandoned).toBe(0);
  });
});

describe('커넥션 풀 — 풀이 차면 요청이 줄을 서요', () => {
  it('도착이 처리보다 빠르면 대기열이 100 을 넘게 쌓여요', () => {
    // 쿼리 0.2초, 커넥션 2개면 처리는 초당 10건이라 초당 20건을 따라잡지 못해요
    const r = simulate({ ...base, rps: 20, poolSize: 2, avgQueryMs: 200, clientTimeoutMs: 30_000 });
    expect(r.maxQueue).toBeGreaterThan(100);
    expect(r.ok).toBe(400);
  });

  it('풀을 넉넉히 두면 같은 도착에서도 대기열이 생기지 않아요', () => {
    const r = simulate({ ...base, rps: 20, poolSize: 20, avgQueryMs: 200 });
    expect(r.maxQueue).toBe(0);
  });
});

describe('계층 순서 — 바깥 시간 제한이 짧으면', () => {
  it('클라이언트가 프록시보다 먼저 포기하면 클라이언트 타임아웃으로 끝나요', () => {
    const r = simulate(slowAll({ clientTimeoutMs: 2000, proxyTimeoutMs: 5000 }));
    expect(r.clientTimeouts).toBe(20);
    expect(r.gateway504).toBe(0);
    expect(r.ok).toBe(0);
  });

  it('포기한 뒤에도 취소를 끄면 DB 작업을 끝까지 실행해서 포기 뒤 처리가 생겨요', () => {
    const r = simulate(slowAll({ clientTimeoutMs: 2000, proxyTimeoutMs: 5000 }));
    expect(r.abandoned).toBe(20);
  });

  it('포기할 때 취소를 켜면 빈 커넥션이 바로 돌아와 포기 뒤 처리가 없어요', () => {
    const r = simulate(slowAll({ clientTimeoutMs: 2000, proxyTimeoutMs: 5000, cancelOnGiveUp: true }));
    expect(r.clientTimeouts).toBe(20);
    expect(r.abandoned).toBe(0);
  });

  it('프록시가 먼저 끊으면 클라이언트는 504 를 받아요', () => {
    const r = simulate(slowAll({ clientTimeoutMs: 5000, proxyTimeoutMs: 1000 }));
    expect(r.gateway504).toBe(20);
    expect(r.clientTimeouts).toBe(0);
  });

  it('DB statement_timeout 이 먼저 끊으면 DB 오류가 응답으로 돌아와요', () => {
    const r = simulate(slowAll({ clientTimeoutMs: 30_000, proxyTimeoutMs: 30_000, dbTimeoutMs: 2000 }));
    expect(r.dbErrors).toBe(20);
    expect(r.ok).toBe(0);
    expect(r.abandoned).toBe(0);
  });

  it('안쪽이 짧고 바깥이 길면 경고가 없어요', () => {
    expect(layerWarnings({ ...base, dbTimeoutMs: 3000, proxyTimeoutMs: 5000, clientTimeoutMs: 8000 })).toEqual([]);
  });

  it('바깥이 안쪽보다 짧으면 어긋난 곳마다 경고를 하나씩 돌려줘요', () => {
    const warnings = layerWarnings({ ...base, clientTimeoutMs: 3000, proxyTimeoutMs: 5000, dbTimeoutMs: 10_000 });
    expect(warnings).toHaveLength(2);
  });
});

describe('재시도 — 실패할 때마다 새 시도가 생겨요', () => {
  it('재시도를 3번 허용하면 실패하는 요청 하나가 시도 4개를 보내요', () => {
    const r = simulate(slowAll({ retries: 3 }));
    expect(r.requests).toBe(20);
    expect(r.attempts).toBe(80);
    expect(r.clientTimeouts).toBe(80);
  });
});

describe('결정적 결과 — 같은 설정과 시드면 같은 결과가 나와요', () => {
  it('두 번 돌려도 모든 수치가 같아요', () => {
    const s: PoolScenario = {
      ...base,
      rps: 10,
      poolSize: 3,
      avgQueryMs: 100,
      slowRatio: 0.2,
      slowQueryMs: 3000,
      clientTimeoutMs: 5000,
      proxyTimeoutMs: 8000,
      dbTimeoutMs: 4000,
      retries: 1,
    };
    expect(simulate(s, 7)).toEqual(simulate(s, 7));
  });
});
