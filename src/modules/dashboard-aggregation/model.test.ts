import { describe, expect, it } from 'vitest';
import {
  bucketKeys,
  bucketStart,
  type Bucket,
  LATE_EVENTS,
  NOW,
  offsetMs,
  type Query,
  runQuery,
  sampleEvents,
  type Strategy,
  type Zone,
} from './model';

const UTC: Zone = 'UTC';
const SEOUL: Zone = 'Asia/Seoul';

const query = (over: Partial<Query> = {}): Query => ({
  range: 90,
  bucket: 'day',
  zone: UTC,
  strategy: 'raw',
  fillGaps: false,
  injectLate: false,
  ...over,
});

const run = (strategy: Strategy, over: Partial<Query> = {}) => runQuery(query({ ...over, strategy }));

describe('시간대 오프셋과 버킷 경계', () => {
  it('서울은 UTC 보다 9시간 앞서요', () => {
    expect(offsetMs(NOW, SEOUL)).toBe(9 * 60 * 60 * 1000);
    expect(offsetMs(NOW, UTC)).toBe(0);
  });

  it('같은 순간도 시간대에 따라 다른 날의 자정에 속해요', () => {
    const instant = Date.parse('2026-03-09T15:30:00Z'); // 서울 3월 10일 0시 30분
    expect(new Date(bucketStart(instant, 'day', SEOUL)).toISOString()).toBe('2026-03-09T15:00:00.000Z');
    expect(new Date(bucketStart(instant, 'day', UTC)).toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('주 버킷은 월요일 0시에서 시작해요', () => {
    const tuesday = Date.parse('2026-03-10T10:00:00Z');
    expect(new Date(bucketStart(tuesday, 'week', UTC)).toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('시 버킷은 서울 벽시계 기준으로 잘라요', () => {
    expect(new Date(bucketStart(NOW, 'hour', SEOUL)).toISOString()).toBe('2026-03-10T03:00:00.000Z');
  });

  it('bucketKeys 는 버킷 수만큼 시작 시각을 돌려줘요', () => {
    const from = Date.parse('2026-03-01T05:00:00Z');
    const to = Date.parse('2026-03-03T23:00:00Z');
    expect(bucketKeys(from, to, 'day' as Bucket, UTC)).toHaveLength(3);
  });
});

describe('예시 주문 이벤트', () => {
  it('같은 결과가 나오도록 고정되어 있어요', () => {
    const a = sampleEvents();
    const b = sampleEvents();
    expect(a).toEqual(b);
    expect(a[0].id).toBe('o-001');
  });

  it('도착은 발생 뒤에만 일어나고, 금액은 천 원 단위 정수예요', () => {
    for (const e of sampleEvents()) {
      expect(e.arrivedAt).toBeGreaterThanOrEqual(e.occurredAt);
      expect(e.amount % 1000).toBe(0);
    }
  });

  it('늦은 예시 주문은 롤업 시각 뒤에 도착해요', () => {
    for (const e of LATE_EVENTS) expect(e.arrivedAt).toBeGreaterThan(NOW - 2 * 60 * 60 * 1000);
  });
});

describe('차트 점과 읽은 행 수', () => {
  it('매번 원본은 기간 안 이벤트 수만큼 행을 읽어요', () => {
    const raw = run('raw');
    const rollup = run('rollup');
    expect(rollup.readRows).toBe(89);
    expect(raw.readRows).toBeGreaterThan(rollup.readRows);
  });

  it('빈 버킷을 채우면 기간의 날짜 수만큼 점이 나오고, 채운 점에 표시가 남아요', () => {
    const filled = run('raw', { fillGaps: true });
    expect(filled.points).toHaveLength(90);
    expect(filled.points.filter((p) => p.filled).length).toBeGreaterThanOrEqual(2);

    const bare = run('raw', { fillGaps: false });
    expect(bare.points.length).toBeLessThan(filled.points.length);
    expect(bare.points.every((p) => !p.filled)).toBe(true);
  });

  it('시간대가 다르면 오늘 점의 값이 달라요', () => {
    const utcToday = run('raw', { zone: UTC }).points.at(-1);
    const seoulToday = run('raw', { zone: SEOUL }).points.at(-1);
    expect(utcToday?.value).toBe(8000);
    expect(seoulToday?.value).toBeGreaterThan(utcToday?.value ?? 0);
  });

  it('주 버킷의 점은 모두 월요일 0시예요', () => {
    const weekly = run('raw', { bucket: 'week', range: 30 });
    for (const p of weekly.points) expect(new Date(p.t).getUTCDay()).toBe(1);
  });
});

describe('롤업과 늦게 도착한 데이터', () => {
  it('롤업만 쓰면 아직 계산되지 않은 오늘 점이 빠져요', () => {
    const r = run('rollup');
    expect(r.pending).toHaveLength(1);
    expect(r.differ).toBe(1);
    expect(r.absDiff).toBe(8000);
  });

  it('롤업 뒤에 도착한 주문이 있으면 그 주문이 있는 날이 원본과 달라요', () => {
    const r = run('rollup', { injectLate: true });
    expect(r.differ).toBe(3);
    expect(r.absDiff).toBe(8000 + 50_000 + 30_000);
    expect(r.notes.some((n) => n.includes('늦게 도착한 주문 2건'))).toBe(true);
  });

  it('오늘만 원본으로 읽어도 늦게 도착한 과거 날짜는 그대로 틀려요', () => {
    const r = run('rollup-today', { injectLate: true });
    expect(r.pending).toHaveLength(0);
    expect(r.differ).toBe(2);
    expect(r.absDiff).toBe(80_000);
    expect(r.readRows).toBe(89 + 1);
  });

  it('빈 칸을 0으로 채우면 아직 계산되지 않은 점도 0으로 보여요', () => {
    const r = run('rollup', { fillGaps: true });
    const today = r.points.at(-1);
    expect(today?.value).toBe(0);
    expect(today?.filled).toBe(true);
    expect(r.notes.some((n) => n.includes('0으로 채웠어요'))).toBe(true);
  });

  it('시 버킷은 롤업으로 만들 수 없어서 원본으로 바꿔 읽어요', () => {
    const r = run('rollup', { bucket: 'hour', range: 7 });
    expect(r.effective).toBe('raw');
    expect(r.notes[0]).toContain('원본을 읽었어요');
  });
});
