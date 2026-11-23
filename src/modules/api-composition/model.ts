export type CallMode = 'rest-seq' | 'rest-par' | 'bff' | 'graphql';

export interface LabConfig {
  mode: CallMode;
  /** 클라이언트 ↔ 서버 왕복 시간 (ms, 예시) */
  rttMs: number;
  /** 서버 내부 서비스 하나의 기준 처리 시간 (ms, 예시). 서비스마다 가중치를 곱해요 */
  serviceMs: number;
}

/** 아래 상수는 모두 설명용 예시 값이에요. 실제 측정치가 아니에요. */
export const INTERNAL_RTT_MS = 2;
export const BYTES_PER_MS = 200;

export interface Downstream {
  id: 'product' | 'seller' | 'shipping' | 'reviews' | 'recommendations';
  label: string;
  /** 서비스마다 처리 시간이 다르다는 것을 나타내는 예시 가중치 */
  weight: number;
  /** 리소스 전체 응답 크기 (bytes, 예시) */
  fullBytes: number;
  /** 화면이 실제로 쓰는 필드 크기 (bytes, 예시) */
  neededBytes: number;
  /** 먼저 끝나야 호출할 수 있는 서비스 */
  deps: Downstream['id'][];
}

/** 상품 상세 화면의 데이터 의존 그래프. 상품 → 판매자 → 배송비, 상품 → 리뷰, 상품 → 추천 */
export const DOWNSTREAMS: readonly Downstream[] = [
  { id: 'product', label: '상품', weight: 1, fullBytes: 4200, neededBytes: 900, deps: [] },
  { id: 'seller', label: '판매자', weight: 0.75, fullBytes: 1800, neededBytes: 260, deps: ['product'] },
  { id: 'shipping', label: '배송비', weight: 0.5, fullBytes: 800, neededBytes: 150, deps: ['seller'] },
  { id: 'reviews', label: '리뷰', weight: 1.25, fullBytes: 9800, neededBytes: 3100, deps: ['product'] },
  { id: 'recommendations', label: '추천', weight: 1.5, fullBytes: 6000, neededBytes: 1200, deps: ['product'] },
];

export interface CallLogItem {
  label: string;
  startMs: number;
  endMs: number;
  bytes: number;
}

export interface LabResult {
  /** 클라이언트가 보내는 요청 수 */
  requests: number;
  /** 서버 안에서 서비스를 부르는 횟수 */
  serverCalls: number;
  /** 화면이 완성될 때까지 걸리는 시간 (ms, 예시) */
  totalMs: number;
  /** 클라이언트가 받는 전체 바이트 */
  bytes: number;
  /** 화면이 실제로 쓰는 바이트 */
  neededBytes: number;
  /** 받았지만 안 쓰는 바이트 (오버페칭) */
  overfetchBytes: number;
  log: CallLogItem[];
}

const clampNonNegative = (n: number) => Math.max(0, Math.floor(n));

const serverMsOf = (d: Downstream, serviceMs: number) => Math.round(d.weight * serviceMs);

const transferMs = (bytes: number) => Math.round(bytes / BYTES_PER_MS);

/**
 * 의존 그래프에서 각 호출이 끝나는 시각을 구한다.
 * 호출 하나의 시간만 주면, 의존이 없는 호출은 같이 나가고 의존이 있는 호출은 부모가 끝난 뒤에 나간다.
 */
function finishTimes(callTime: (d: Downstream) => number): Map<Downstream['id'], { start: number; end: number }> {
  const times = new Map<Downstream['id'], { start: number; end: number }>();
  const visit = (d: Downstream): number => {
    const cached = times.get(d.id);
    if (cached) return cached.end;
    const start = d.deps.reduce((latest, depId) => {
      const dep = DOWNSTREAMS.find((x) => x.id === depId);
      return dep ? Math.max(latest, visit(dep)) : latest;
    }, 0);
    const end = start + callTime(d);
    times.set(d.id, { start, end });
    return end;
  };
  DOWNSTREAMS.forEach(visit);
  return times;
}

export function runLab({ mode, rttMs, serviceMs }: LabConfig): LabResult {
  const rtt = clampNonNegative(rttMs);
  const service = clampNonNegative(serviceMs);
  const sumFull = DOWNSTREAMS.reduce((sum, d) => sum + d.fullBytes, 0);
  const sumNeeded = DOWNSTREAMS.reduce((sum, d) => sum + d.neededBytes, 0);

  if (mode === 'rest-seq') {
    let cursor = 0;
    const log: CallLogItem[] = DOWNSTREAMS.map((d) => {
      const start = cursor;
      cursor += rtt + serverMsOf(d, service) + transferMs(d.fullBytes);
      return { label: `${d.label} REST`, startMs: start, endMs: cursor, bytes: d.fullBytes };
    });
    return {
      requests: DOWNSTREAMS.length,
      serverCalls: 0,
      totalMs: cursor,
      bytes: sumFull,
      neededBytes: sumNeeded,
      overfetchBytes: sumFull - sumNeeded,
      log,
    };
  }

  if (mode === 'rest-par') {
    const times = finishTimes((d) => rtt + serverMsOf(d, service) + transferMs(d.fullBytes));
    const log: CallLogItem[] = DOWNSTREAMS.map((d) => {
      const t = times.get(d.id)!;
      return { label: `${d.label} REST`, startMs: t.start, endMs: t.end, bytes: d.fullBytes };
    });
    return {
      requests: DOWNSTREAMS.length,
      serverCalls: 0,
      totalMs: Math.max(...log.map((item) => item.endMs)),
      bytes: sumFull,
      neededBytes: sumNeeded,
      overfetchBytes: sumFull - sumNeeded,
      log,
    };
  }

  // BFF 와 GraphQL: 클라이언트는 한 번 요청하고, 서버 안에서 같은 의존 그래프를 병렬로 푼다
  const inner = finishTimes((d) => INTERNAL_RTT_MS + serverMsOf(d, service));
  const innerEnd = Math.max(...Array.from(inner.values(), (t) => t.end));
  const label = mode === 'bff' ? 'BFF 한 번' : 'GraphQL 한 번';
  return {
    requests: 1,
    serverCalls: DOWNSTREAMS.length,
    totalMs: rtt + innerEnd + transferMs(sumNeeded),
    bytes: sumNeeded,
    neededBytes: sumNeeded,
    overfetchBytes: 0,
    log: [{ label, startMs: 0, endMs: rtt + innerEnd + transferMs(sumNeeded), bytes: sumNeeded }],
  };
}
