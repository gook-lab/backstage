import { type DegradeScenario, simulateDegrade } from './model';

/** Simulator 의 기본값과 같아요. 초당 50건, 장애 구간 추천 응답 3초, 추천 호출 시간 제한 1초, 재시도 1번 */
const base: DegradeScenario = {
  rps: 50,
  synced: false,
  faultLatencyMs: 3000,
  faultFailRate: 0.3,
  callTimeoutMs: 1000,
  breaker: false,
  breakerThreshold: 5,
  breakerOpenMs: 5000,
  retries: 1,
  jitter: false,
  bulkhead: false,
  fallback: false,
};

describe('정상 상황 — 추천이 빠르면', () => {
  it('모든 요청이 정상 응답을 받고 추천 호출은 요청 수만큼 나가요', () => {
    const r = simulateDegrade({ ...base, faultLatencyMs: 80, faultFailRate: 0 });
    expect(r.requests).toBe(3000);
    expect(r.ok).toBe(3000);
    expect(r.failed).toBe(0);
    expect(r.depCalls).toBe(3000);
  });
});

describe('칸 고갈 — 추천 호출이 칸을 나눠 쓰면', () => {
  it('장애 구간에 상품 정보 호출이 칸을 받지 못해 실패해요', () => {
    const r = simulateDegrade(base);
    expect(r.coreFailed).toBeGreaterThan(0);
    expect(r.failed).toBeGreaterThanOrEqual(r.coreFailed);
  });

  it('대체 응답만 켜도 상품 정보 실패는 남아요', () => {
    const r = simulateDegrade({ ...base, fallback: true });
    expect(r.degraded).toBeGreaterThan(0);
    expect(r.failed).toBe(r.coreFailed);
    expect(r.failed).toBeGreaterThan(0);
  });
});

describe('벌크헤드 — 추천에 칸을 떼어 주면', () => {
  it('상품 정보 호출은 칸을 잃지 않아요', () => {
    const naive = simulateDegrade(base);
    const bulk = simulateDegrade({ ...base, bulkhead: true });
    expect(naive.coreFailed).toBeGreaterThan(0);
    expect(bulk.coreFailed).toBe(0);
    expect(bulk.slotBlocked).toBeGreaterThan(0);
  });

  it('추천 실패를 대체 응답으로 받으면 페이지 실패가 0이 돼요', () => {
    const r = simulateDegrade({ ...base, bulkhead: true, fallback: true });
    expect(r.failed).toBe(0);
    expect(r.degraded).toBeGreaterThan(0);
  });
});

describe('서킷 브레이커 — 열리면 추천 호출을 멈춰요', () => {
  it('추천 서비스로 가는 호출이 줄고 상품 정보 실패도 크게 줄어요', () => {
    const naive = simulateDegrade({ ...base, fallback: true });
    const breaker = simulateDegrade({ ...base, breaker: true, fallback: true });
    expect(breaker.breakerTrips).toBeGreaterThanOrEqual(2);
    expect(breaker.breakerBlocked).toBeGreaterThan(0);
    expect(breaker.depCalls).toBeLessThan(naive.depCalls * 0.7);
    expect(breaker.coreFailed).toBeLessThan(naive.coreFailed / 10);
  });

  it('장애가 끝나면 반열림 시험이 성공해서 뒤쪽 요청은 실패하지 않아요', () => {
    const r = simulateDegrade({ ...base, breaker: true });
    const afterRecovery = r.perSecond.slice(50).reduce((sum, s) => sum + s.failed, 0);
    expect(afterRecovery).toBe(0);
  });
});

describe('재시도 — 칸을 더 쓰게 만들어요', () => {
  it('재시도를 0번에서 1번으로 올리면 상품 정보 실패가 늘어요', () => {
    const none = simulateDegrade({ ...base, retries: 0 });
    const one = simulateDegrade({ ...base, retries: 1 });
    expect(one.coreFailed).toBeGreaterThan(none.coreFailed);
    expect(one.depCalls).toBeGreaterThan(none.depCalls);
  });
});

describe('지터 — 같은 순간 몰린 재시도를 흩어요', () => {
  it('동기화된 요청에서 지터를 켜면 가장 몰린 순간의 호출 수가 줄어요', () => {
    const plain = simulateDegrade({ ...base, synced: true, retries: 2 });
    const jittered = simulateDegrade({ ...base, synced: true, retries: 2, jitter: true });
    expect(jittered.peakCallsPerTick).toBeLessThan(plain.peakCallsPerTick);
  });
});

describe('결정성', () => {
  it('같은 설정과 시드면 항상 같은 결과가 나와요', () => {
    expect(simulateDegrade(base, 7)).toEqual(simulateDegrade(base, 7));
  });
});
