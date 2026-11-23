/** 설명용 예시 값이에요. 실제 서비스를 측정한 값이 아니에요. */
export interface ObsConfig {
  /** 상품마다 DB 를 따로 조회해요 (N+1) */
  readonly nPlusOne: boolean;
  /** 외부 결제 API 가 느려요 */
  readonly slowPayment: boolean;
  /** 응답이 커서 직렬화와 전송이 길어져요 */
  readonly bigResponse: boolean;
}

export const DEFAULT_CONFIG: ObsConfig = { nPlusOne: false, slowPayment: false, bigResponse: false };

export const ITEM_COUNT = 12;
/** 행 하나를 가져오는 쿼리 한 번. 왕복 지연까지 포함한 예시 값 */
export const DB_QUERY_MS = 9;
/** IN 으로 상품 여러 개를 한 번에 가져오는 쿼리 예시 값 */
export const DB_BATCH_MS = 14;
export const PAYMENT_BASE_MS = 120;
export const PAYMENT_SLOW_EXTRA_MS = 800;
export const SERIALIZE_BASE_MS = 3;
export const SERIALIZE_BIG_EXTRA_MS = 180;
export const GATEWAY_MS = 4;
export const PAYMENT_SAVE_MS = 12;

/** 요청 100개를 흉내 내는 설정 */
export const REQUEST_COUNT = 100;
export const SEED = 20260401;
/** 평소에도 가끔 외부 호출이 몇 배 느린 경우. 비율과 배수는 예시 값이에요 */
export const TAIL_RATE = 0.04;
export const TAIL_MULTIPLIER = 5;
export const JITTER_MIN = 0.85;
export const JITTER_MAX = 1.15;

export type SpanKind = 'root' | 'gateway' | 'api' | 'db' | 'external' | 'serialize';

export interface Span {
  readonly id: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly depth: number;
  readonly start: number;
  readonly duration: number;
}

export interface Trace {
  readonly spans: readonly Span[];
  readonly total: number;
  readonly dbQueries: number;
  readonly dbMs: number;
  readonly externalMs: number;
  readonly serializeMs: number;
  /** 가장 오래 걸린 말단 span. 워터폴에서 강조해요 */
  readonly longestId: string;
}

interface Leaf {
  id: string;
  name: string;
  kind: SpanKind;
  depth: number;
  duration: number;
  /** 같은 부모 아래 자식 묶음이면 api 의 id */
  parent?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 요청 하나의 span 트리를 만들어요. 모든 자식은 앞 형제가 끝난 뒤 시작하는 순차 실행으로 가정해요.
 * jitter 는 모든 구간에 곱하고, tail 은 외부 결제 호출에만 곱해요.
 */
export function buildTrace(config: ObsConfig, jitter = 1, tail = 1): Trace {
  const j = (ms: number) => ms * jitter;

  const leaves: Leaf[] = [];
  leaves.push({ id: 'gateway', name: '게이트웨이 · 라우팅', kind: 'gateway', depth: 1, duration: j(GATEWAY_MS) });

  leaves.push({ id: 'session', name: 'DB · 세션 조회', kind: 'db', depth: 2, duration: j(DB_QUERY_MS), parent: 'api' });
  leaves.push({
    id: 'cart',
    name: 'DB · 장바구니 조회',
    kind: 'db',
    depth: 2,
    duration: j(DB_QUERY_MS),
    parent: 'api',
  });

  if (config.nPlusOne) {
    for (let i = 1; i <= ITEM_COUNT; i += 1) {
      leaves.push({
        id: `item-${i}`,
        name: `DB · 상품 ${i} 조회`,
        kind: 'db',
        depth: 2,
        duration: j(DB_QUERY_MS),
        parent: 'api',
      });
    }
  } else {
    leaves.push({
      id: 'items',
      name: `DB · 상품 ${ITEM_COUNT}개 IN 조회`,
      kind: 'db',
      depth: 2,
      duration: j(DB_BATCH_MS),
      parent: 'api',
    });
  }

  const paymentBase = PAYMENT_BASE_MS + (config.slowPayment ? PAYMENT_SLOW_EXTRA_MS : 0);
  leaves.push({
    id: 'payment',
    name: '외부 결제 API 호출',
    kind: 'external',
    depth: 2,
    duration: j(paymentBase) * tail,
    parent: 'api',
  });
  leaves.push({
    id: 'save',
    name: 'DB · 결제 기록 저장',
    kind: 'db',
    depth: 2,
    duration: j(PAYMENT_SAVE_MS),
    parent: 'api',
  });

  const serializeBase = SERIALIZE_BASE_MS + (config.bigResponse ? SERIALIZE_BIG_EXTRA_MS : 0);
  leaves.push({ id: 'serialize', name: '응답 직렬화 · 전송', kind: 'serialize', depth: 1, duration: j(serializeBase) });

  // 자식 span 의 시작 시각은 앞 말단이 끝난 시각이고, 부모는 자식들의 범위로 정해요.
  const starts = new Map<string, number>();
  let cursor = 0;
  for (const leaf of leaves) {
    starts.set(leaf.id, cursor);
    cursor += leaf.duration;
  }
  const total = cursor;

  const apiChildren = leaves.filter((l) => l.parent === 'api');
  const apiStart = starts.get(apiChildren[0].id) ?? 0;
  const apiEnd = apiChildren.reduce((end, l) => Math.max(end, (starts.get(l.id) ?? 0) + l.duration), apiStart);
  const byId = new Map(leaves.map((l) => [l.id, l]));

  const spans: Span[] = [
    { id: 'root', name: '요청 전체', kind: 'root', depth: 0, start: 0, duration: round1(total) },
    span(byId.get('gateway') as Leaf, starts),
    {
      id: 'api',
      name: 'API 서버 · 결제 확정',
      kind: 'api',
      depth: 1,
      start: round1(apiStart),
      duration: round1(apiEnd - apiStart),
    },
    ...apiChildren.map((l) => span(l, starts)),
    span(byId.get('serialize') as Leaf, starts),
  ];

  const dbLeaves = leaves.filter((l) => l.kind === 'db');
  const longest = leaves.reduce((best, l) => (l.duration > best.duration ? l : best), leaves[0]);

  return {
    spans,
    total: round1(total),
    dbQueries: dbLeaves.length,
    dbMs: round1(dbLeaves.reduce((sum, l) => sum + l.duration, 0)),
    externalMs: round1(leaves.filter((l) => l.kind === 'external').reduce((s, l) => s + l.duration, 0)),
    serializeMs: round1(leaves.filter((l) => l.kind === 'serialize').reduce((s, l) => s + l.duration, 0)),
    longestId: longest.id,
  };
}

function span(leaf: Leaf, starts: Map<string, number>): Span {
  return {
    id: leaf.id,
    name: leaf.name,
    kind: leaf.kind,
    depth: leaf.depth,
    start: round1(starts.get(leaf.id) ?? 0),
    duration: round1(leaf.duration),
  };
}

export function serverTimingHeader(trace: Trace): string {
  return [
    `db;dur=${trace.dbMs};desc="DB ${trace.dbQueries}회"`,
    `payment;dur=${trace.externalMs}`,
    `serialize;dur=${trace.serializeMs}`,
  ].join(', ');
}

/** 결정적 난수. 같은 seed 는 같은 수열을 줘요 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 요청 여러 개의 총 시간. 같은 설정이면 항상 같은 값이 나와요 */
export function runRequests(config: ObsConfig, count = REQUEST_COUNT, seed = SEED): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const jitter = JITTER_MIN + (JITTER_MAX - JITTER_MIN) * rand();
    const tail = rand() < TAIL_RATE ? TAIL_MULTIPLIER : 1;
    out.push(buildTrace(config, jitter, tail).total);
  }
  return out;
}

/** 최근순위(nearest-rank) 백분위. p=99, n=100 이면 정렬된 값의 99번째 값을 골라요 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export interface Summary {
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  readonly samples: readonly number[];
}

export function summarize(values: readonly number[]): Summary {
  const avg = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  return {
    avg: round1(avg),
    p50: round1(percentile(values, 50)),
    p95: round1(percentile(values, 95)),
    p99: round1(percentile(values, 99)),
    max: round1(Math.max(...values)),
    samples: [...values].sort((a, b) => a - b),
  };
}

export const CAUSE_LABEL: Record<keyof ObsConfig, string> = {
  nPlusOne: 'N+1 쿼리',
  slowPayment: '외부 결제 API 지연',
  bigResponse: '큰 응답',
};
