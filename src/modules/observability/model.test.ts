import { describe, expect, it } from 'vitest';
import {
  buildTrace,
  DEFAULT_CONFIG,
  ITEM_COUNT,
  type ObsConfig,
  mulberry32,
  percentile,
  runRequests,
  serverTimingHeader,
  summarize,
} from './model';

const ALL_ON: ObsConfig = { nPlusOne: true, slowPayment: true, bigResponse: true };

describe('요청 하나의 span 트리', () => {
  it('기본 설정에서는 DB 쿼리 4번과 외부 결제 호출 하나로 이루어져요', () => {
    const trace = buildTrace(DEFAULT_CONFIG);
    expect(trace.dbQueries).toBe(4);
    expect(trace.externalMs).toBe(120);
    expect(trace.total).toBe(171);
  });

  it('부모 span 의 시간은 자식 span 시간의 합과 같아요', () => {
    const trace = buildTrace(ALL_ON);
    const byId = new Map(trace.spans.map((s) => [s.id, s]));
    const api = byId.get('api');
    const children = trace.spans.filter((s) => s.depth === 2);
    const childSum = children.reduce((sum, s) => sum + s.duration, 0);
    expect(api?.duration).toBeCloseTo(childSum, 1);
    expect(trace.total).toBeCloseTo(
      (byId.get('gateway')?.duration ?? 0) + (api?.duration ?? 0) + (byId.get('serialize')?.duration ?? 0),
      1,
    );
  });

  it('N+1 을 켜면 상품 조회가 하나씩 12번 나가고 쿼리 수가 15번이 돼요', () => {
    const trace = buildTrace({ ...DEFAULT_CONFIG, nPlusOne: true });
    const items = trace.spans.filter((s) => s.id.startsWith('item-'));
    expect(items).toHaveLength(ITEM_COUNT);
    expect(trace.dbQueries).toBe(15);
    expect(trace.total - buildTrace(DEFAULT_CONFIG).total).toBeCloseTo(94, 1);
  });

  it('외부 결제 API 가 느려지면 그 span 이 가장 길어요', () => {
    const trace = buildTrace({ ...DEFAULT_CONFIG, slowPayment: true });
    expect(trace.longestId).toBe('payment');
    expect(trace.externalMs).toBe(920);
  });

  it('큰 응답은 직렬화 span 을 길게 만들어 그 구간이 가장 길어져요', () => {
    const trace = buildTrace({ ...DEFAULT_CONFIG, bigResponse: true });
    const serialize = trace.spans.find((s) => s.id === 'serialize');
    expect(serialize?.duration).toBe(183);
    expect(trace.longestId).toBe('serialize');
  });

  it('기본 설정에서 가장 긴 span 은 외부 결제 호출이에요', () => {
    expect(buildTrace(DEFAULT_CONFIG).longestId).toBe('payment');
  });

  it('Server-Timing 값은 DB · 결제 · 직렬화 합계를 담아요', () => {
    expect(serverTimingHeader(buildTrace(DEFAULT_CONFIG))).toContain('payment;dur=120');
  });
});

describe('백분위', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);

  it('요청 100개에서 p50 · p95 · p99 는 정렬한 순위의 값이에요', () => {
    expect(percentile(hundred, 50)).toBe(50);
    expect(percentile(hundred, 95)).toBe(95);
    expect(percentile(hundred, 99)).toBe(99);
  });

  it('입력 순서와 상관없이 같은 백분위가 나와요', () => {
    expect(percentile([5, 1, 9, 3], 50)).toBe(percentile([9, 3, 1, 5], 50));
  });

  it('평균은 느린 꼬리를 가려요. 기본 설정에서도 p99 는 평균의 두 배를 넘어요', () => {
    const s = summarize(runRequests(DEFAULT_CONFIG));
    expect(s.p99).toBeGreaterThan(s.avg * 2);
    expect(s.max).toBeGreaterThanOrEqual(s.p99);
  });

  it('N+1 을 켜면 평균이 올라가요', () => {
    const base = summarize(runRequests(DEFAULT_CONFIG));
    const nPlusOne = summarize(runRequests({ ...DEFAULT_CONFIG, nPlusOne: true }));
    expect(nPlusOne.avg).toBeGreaterThan(base.avg);
  });
});

describe('결정적 시드', () => {
  it('같은 설정이면 요청 100개의 결과가 항상 같아요', () => {
    const a = runRequests(ALL_ON);
    const b = runRequests(ALL_ON);
    expect(a).toHaveLength(100);
    expect(a).toEqual(b);
  });

  it('같은 seed 는 같은 난수 수열을, 값은 0 이상 1 미만으로 줘요', () => {
    const r1 = mulberry32(7);
    const r2 = mulberry32(7);
    const first = Array.from({ length: 5 }, () => r1());
    expect(first).toEqual(Array.from({ length: 5 }, () => r2()));
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
