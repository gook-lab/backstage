/**
 * 대시보드 차트 집계를 흉내 내는 순수 함수.
 * 가짜 주문 이벤트를 90일치 만들고, 기간 · 버킷 · 시간대 · 집계 방식에 따라
 * 차트 점, 읽은 행 수, 원본과의 차이를 계산해요. 모든 수치는 예시예요.
 */

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** 화면을 연 시각 (예시). 시간대별 "오늘" 은 이 시각을 기준으로 정해요 */
export const NOW = Date.parse('2026-03-10T03:20:00Z');

/** 일별 롤업을 매일 자정 10분 뒤에 갱신한다고 가정해요 (예시) */
const ROLLUP_DELAY = 10 * MIN;

export type Range = 7 | 30 | 90;
export type Bucket = 'hour' | 'day' | 'week';
export type Zone = 'UTC' | 'Asia/Seoul';
export type Strategy = 'raw' | 'rollup' | 'rollup-today';

export interface OrderEvent {
  id: string;
  /** 주문이 실제로 일어난 시각 (epoch ms) */
  occurredAt: number;
  /** DB 에 도착한 시각. 늦게 도착한 이벤트는 occurredAt 보다 많이 늦어요 */
  arrivedAt: number;
  /** 원 단위 정수 */
  amount: number;
}

export interface Query {
  range: Range;
  bucket: Bucket;
  zone: Zone;
  strategy: Strategy;
  fillGaps: boolean;
  injectLate: boolean;
}

export interface Point {
  /** 버킷 시작 시각 (epoch ms) */
  t: number;
  value: number;
  count: number;
  /** 원래 데이터가 없어서 0으로 채운 점 */
  filled: boolean;
}

export interface QueryResult {
  points: Point[];
  /** 아직 계산되지 않은 버킷 (롤업에 없는 오늘 등) */
  pending: number[];
  /** 원본 기준 점과 값이 다른 점 수 */
  differ: number;
  /** 원본과의 차이 절댓값 합 (원 단위) */
  absDiff: number;
  /** 읽은 행 수. 원본은 이벤트 수, 롤업은 일별 행 수 */
  readRows: number;
  /** 실제로 쓴 집계 방식 */
  effective: Strategy;
  notes: string[];
}

const GAP_DAYS: readonly number[] = [38, 39];

/** 예시 주문 90일치. 같은 입력이면 항상 같은 결과가 나와요 */
export function sampleEvents(): OrderEvent[] {
  const out: OrderEvent[] = [];
  const today = Date.parse('2026-03-10T00:00:00Z');
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    if (GAP_DAYS.includes(daysAgo)) continue;
    const dayStart = today - daysAgo * DAY;
    const perDay = 2 + ((daysAgo * 7) % 4);
    for (let k = 0; k < perDay; k += 1) {
      const occurredAt = dayStart + ((daysAgo * 5 + k * 7) % 24) * HOUR + ((k * 13 + daysAgo) % 60) * MIN;
      if (occurredAt > NOW) continue;
      out.push({
        id: `o-${String(out.length + 1).padStart(3, '0')}`,
        occurredAt,
        arrivedAt: occurredAt + 2 * MIN,
        amount: (8 + ((daysAgo * 37 + k * 11) % 30)) * 1000,
      });
    }
  }
  return out;
}

/** 롤업이 만들어진 뒤에 도착한 예시 주문 */
export const LATE_EVENTS: readonly OrderEvent[] = [
  { id: 'late-1', occurredAt: Date.parse('2026-03-07T14:00:00Z'), arrivedAt: NOW - HOUR, amount: 50_000 },
  { id: 'late-2', occurredAt: Date.parse('2026-03-04T09:00:00Z'), arrivedAt: NOW - HOUR, amount: 30_000 },
];

const BASE_EVENTS = sampleEvents();

const formatters = new Map<Zone, Intl.DateTimeFormat>();

function formatterFor(zone: Zone): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** 시각에서 시간대의 UTC 오프셋 (ms). Intl 이 서머타임 규칙을 계산해 줘요 */
export function offsetMs(instant: number, zone: Zone): number {
  if (zone === 'UTC') return 0;
  const parts = formatterFor(zone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** 시각이 속한 버킷의 시작 시각. 시간대의 벽시계 기준으로 자르고, 다시 실제 시각으로 되돌려요 */
export function bucketStart(instant: number, bucket: Bucket | 'day', zone: Zone): number {
  const wall = Math.floor(instant / 1000) * 1000 + offsetMs(instant, zone);
  const unit = bucket === 'hour' ? HOUR : DAY;
  let start = Math.floor(wall / unit) * unit;
  if (bucket === 'week') {
    const dow = new Date(start).getUTCDay(); // 0 = 일요일
    start -= ((dow + 6) % 7) * DAY; // 월요일 시작
  }
  const guess = start - offsetMs(start, zone);
  return start - offsetMs(guess, zone);
}

/** from 이 속한 버킷부터 to 가 속한 버킷까지의 시작 시각 목록 */
export function bucketKeys(from: number, to: number, bucket: Bucket, zone: Zone): number[] {
  const step = bucket === 'hour' ? HOUR : bucket === 'day' ? DAY : 7 * DAY;
  const half = bucket === 'hour' ? 30 * MIN : 12 * HOUR;
  const last = bucketStart(to, bucket, zone);
  const keys: number[] = [];
  for (let cur = bucketStart(from, bucket, zone); cur <= last; cur = bucketStart(cur + step + half, bucket, zone)) {
    keys.push(cur);
  }
  return keys;
}

interface Sum {
  sum: number;
  count: number;
}

function evaluate(q: Query, strategy: Strategy) {
  const notes: string[] = [];
  const events = q.injectLate ? [...BASE_EVENTS, ...LATE_EVENTS] : BASE_EVENTS;
  const todayStart = bucketStart(NOW, 'day', q.zone);
  const windowStart = bucketStart(NOW - (q.range - 1) * DAY, 'day', q.zone);
  const rollupAt = todayStart + ROLLUP_DELAY;
  const inWindow = events.filter((e) => e.occurredAt >= windowStart && e.occurredAt <= NOW);

  const sums = new Map<number, Sum>();
  const computed = new Set<number>();
  const add = (key: number, amount: number, count: number) => {
    const cur = sums.get(key) ?? { sum: 0, count: 0 };
    sums.set(key, { sum: cur.sum + amount, count: cur.count + count });
  };

  let readRows: number;
  if (strategy === 'raw') {
    for (const e of inWindow) add(bucketStart(e.occurredAt, q.bucket, q.zone), e.amount, 1);
    readRows = inWindow.length;
  } else {
    // 롤업은 끝난 날만 가져요. 도착이 롤업 시각 뒤인 주문은 빠져요.
    const completed = bucketKeys(windowStart, todayStart - 1, 'day', q.zone);
    const daily = new Map<number, Sum>();
    for (const d of completed) daily.set(d, { sum: 0, count: 0 });
    for (const e of events) {
      if (e.occurredAt < windowStart || e.occurredAt >= todayStart) continue;
      if (e.arrivedAt > rollupAt) continue;
      const d = daily.get(bucketStart(e.occurredAt, 'day', q.zone));
      if (d) {
        d.sum += e.amount;
        d.count += 1;
      }
    }
    for (const [d, s] of daily) {
      const key = bucketStart(d, q.bucket, q.zone);
      add(key, s.sum, s.count);
      computed.add(key);
    }
    readRows = completed.length;

    if (strategy === 'rollup-today') {
      const todayKey = bucketStart(todayStart, q.bucket, q.zone);
      for (const e of inWindow) {
        if (e.occurredAt >= todayStart) {
          add(bucketStart(e.occurredAt, q.bucket, q.zone), e.amount, 1);
          readRows += 1;
        }
      }
      computed.add(todayKey);
    }

    const late = LATE_EVENTS.filter((e) => e.occurredAt >= windowStart && e.occurredAt < todayStart);
    if (q.injectLate && late.length > 0) {
      notes.push(`늦게 도착한 주문 ${late.length}건은 롤업을 만든 뒤에 들어와서 빠졌어요.`);
    }
  }

  const points: Point[] = [];
  const pending: number[] = [];
  for (const t of bucketKeys(windowStart, NOW, q.bucket, q.zone)) {
    const s = sums.get(t);
    if (strategy !== 'raw' && !computed.has(t)) pending.push(t);
    if (s) {
      points.push({ t, value: s.sum, count: s.count, filled: false });
    } else if (q.fillGaps) {
      points.push({ t, value: 0, count: 0, filled: true });
    }
  }
  return { points, pending, readRows, notes };
}

export function runQuery(q: Query): QueryResult {
  const effective: Strategy = q.bucket === 'hour' && q.strategy !== 'raw' ? 'raw' : q.strategy;
  const result = evaluate({ ...q, strategy: effective }, effective);
  const truth = evaluate({ ...q, strategy: 'raw' }, 'raw');

  const truthMap = new Map(truth.points.map((p) => [p.t, p.value]));
  const shownMap = new Map(result.points.map((p) => [p.t, p.value]));
  let differ = 0;
  let absDiff = 0;
  for (const [t, truthValue] of truthMap) {
    const diff = (shownMap.get(t) ?? 0) - truthValue;
    if (diff !== 0) {
      differ += 1;
      absDiff += Math.abs(diff);
    }
  }

  const notes = [...result.notes];
  if (effective !== q.strategy) notes.unshift('시 단위는 일별 롤업으로 만들 수 없어서 원본을 읽었어요.');
  if (result.pending.length > 0) {
    notes.push(
      q.fillGaps
        ? '빈 칸을 0으로 채웠어요. 아직 계산되지 않은 점도 0으로 보이니 0과 구분해야 해요.'
        : `아직 계산되지 않은 점 ${result.pending.length}개가 차트에서 빠졌어요.`,
    );
  }

  return {
    points: result.points,
    pending: result.pending,
    differ,
    absDiff,
    readRows: result.readRows,
    effective,
    notes,
  };
}

export const KRW = (n: number) => `${n.toLocaleString('ko-KR')}원`;
