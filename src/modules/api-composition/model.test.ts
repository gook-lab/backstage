import { runLab, type CallMode, type LabConfig } from './model';

const base: LabConfig = { mode: 'rest-seq', rttMs: 120, serviceMs: 20 };
const run = (patch: Partial<LabConfig>) => runLab({ ...base, ...patch });
const withMode = (mode: CallMode) => run({ mode });

describe('기본값 (왕복 120ms, 서비스 기준 20ms, 예시)', () => {
  it('REST 를 순서대로 부르면 요청 5번, 813ms 가 걸려요', () => {
    const result = withMode('rest-seq');
    expect(result.requests).toBe(5);
    expect(result.totalMs).toBe(813);
  });

  it('REST 를 의존 관계가 허용하는 만큼 병렬로 부르면 439ms 로 줄어요', () => {
    const result = withMode('rest-par');
    expect(result.requests).toBe(5);
    expect(result.totalMs).toBe(439);
  });

  it('BFF 와 GraphQL 은 요청 1번, 202ms 예요', () => {
    for (const mode of ['bff', 'graphql'] as const) {
      const result = withMode(mode);
      expect(result.requests).toBe(1);
      expect(result.totalMs).toBe(202);
    }
  });
});

describe('요청 수와 서버 내부 호출 수', () => {
  it('BFF 는 클라이언트 요청을 1번으로 줄이지만 서버 안 호출 수는 그대로 5번이에요', () => {
    const result = withMode('bff');
    expect(result.serverCalls).toBe(5);
  });

  it('REST 는 서버 안 호출 수를 세지 않아요 (클라이언트가 직접 부르므로)', () => {
    expect(withMode('rest-seq').serverCalls).toBe(0);
  });
});

describe('왕복 시간에 따른 변화', () => {
  it('왕복이 1ms 늘면 순차 REST 는 호출 수만큼 5ms 늘어요', () => {
    const a = run({ mode: 'rest-seq', rttMs: 100 });
    const b = run({ mode: 'rest-seq', rttMs: 101 });
    expect(b.totalMs - a.totalMs).toBe(5);
  });

  it('왕복이 1ms 늘면 BFF 는 한 번만 1ms 늘어요', () => {
    const a = run({ mode: 'bff', rttMs: 100 });
    const b = run({ mode: 'bff', rttMs: 101 });
    expect(b.totalMs - a.totalMs).toBe(1);
  });

  it('왕복이 커지면 호출 수가 많은 방식일수록 차이가 벌어져요', () => {
    const gapAt = (rttMs: number) => run({ mode: 'rest-seq', rttMs }).totalMs - run({ mode: 'bff', rttMs }).totalMs;
    expect(gapAt(300)).toBeGreaterThan(gapAt(20));
  });
});

describe('병렬 호출의 완성 시간', () => {
  it('병렬 REST 완성 시간은 의존 경로에서 가장 긴 경로와 같아요', () => {
    // 상품(161) → 판매자(305) → 배송비(439). 리뷰와 추천은 상품 뒤에 나란히 나가요.
    const result = withMode('rest-par');
    const shipping = result.log.find((item) => item.label === '배송비 REST');
    expect(shipping?.startMs).toBe(305);
    expect(shipping?.endMs).toBe(439);
  });

  it('병렬 REST 는 순차 REST 보다 빠르거나 같아요', () => {
    for (const rttMs of [1, 50, 120, 300]) {
      const seq = run({ mode: 'rest-seq', rttMs }).totalMs;
      const par = run({ mode: 'rest-par', rttMs }).totalMs;
      expect(par).toBeLessThanOrEqual(seq);
    }
  });
});

describe('전송 바이트와 오버페칭', () => {
  it('REST 는 리소스 전체를 받아 22600 바이트 중 5610 바이트만 써요', () => {
    const result = withMode('rest-seq');
    expect(result.bytes).toBe(22600);
    expect(result.neededBytes).toBe(5610);
    expect(result.overfetchBytes).toBe(16990);
  });

  it('BFF 와 GraphQL 은 화면이 쓰는 필드만 받아 오버페칭이 없어요', () => {
    for (const mode of ['bff', 'graphql'] as const) {
      const result = withMode(mode);
      expect(result.bytes).toBe(5610);
      expect(result.overfetchBytes).toBe(0);
    }
  });
});

describe('입력 보정', () => {
  it('음수나 소수 입력은 0 이상 정수로 맞춰요', () => {
    const result = run({ mode: 'bff', rttMs: -10, serviceMs: 20.9 });
    expect(result.totalMs).toBe(run({ mode: 'bff', rttMs: 0, serviceMs: 20 }).totalMs);
  });
});
