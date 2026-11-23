/** 자정부터 잰 분. 09:00 은 540, 18:00 은 1080 이에요 */
export interface Interval {
  readonly start: number;
  /** 반열린 구간 [start, end) 의 끝. 끝 시각 자신은 구간에 들어가지 않아요 */
  readonly end: number;
}

export interface Booking extends Interval {
  readonly owner: string;
}

/** 두 구간이 겹치는 조건: a.start < b.end 이고 b.start < a.end */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** 영업시간 안에서 예약이 비어 있는 구간을 시작 순으로 돌려줘요 */
export function freeWindows(open: Interval, booked: readonly Interval[]): Interval[] {
  const sorted = [...booked].sort((a, b) => a.start - b.start);
  const free: Interval[] = [];
  let cursor = open.start;
  for (const b of sorted) {
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, open.end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= open.end) break;
  }
  if (cursor < open.end) free.push({ start: cursor, end: open.end });
  return free.filter((w) => w.end > w.start);
}

export const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const formatRange = (i: Interval): string => `${formatTime(i.start)}~${formatTime(i.end)}`;

/** 영업시간 09:00~18:00. 시뮬레이터의 방은 하나예요 */
export const OPEN: Interval = { start: 540, end: 1080 };

export const EXISTING: readonly Booking[] = [
  { owner: '기존 예약 A', start: 600, end: 660 },
  { owner: '기존 예약 B', start: 780, end: 840 },
  { owner: '기존 예약 C', start: 960, end: 1020 },
];

export type Mode = 'none' | 'check' | 'exclusion';
export type Timing = 'concurrent' | 'sequential';

export const MODES: readonly { id: Mode; label: string; summary: string }[] = [
  {
    id: 'none',
    label: '확인 없음',
    summary: '겹치는지 보지 않고 바로 저장해요. 두 요청이 모두 저장되면 같은 시간에 예약이 두 개가 돼요.',
  },
  {
    id: 'check',
    label: '확인 후 삽입',
    summary:
      '먼저 SELECT 로 겹치는 예약이 있는지 보고, 없으면 INSERT 해요. 확인과 저장 사이에 다른 요청이 끼어들 수 있어요.',
  },
  {
    id: 'exclusion',
    label: '배제 제약',
    summary: 'DB 가 저장할 때마다 겹침을 검사해요. 겹치면 23P01 로 실패하고, 앱은 409 로 답해요.',
  },
];

export const TIMINGS: readonly { id: Timing; label: string }[] = [
  { id: 'concurrent', label: '같은 순간에 두 요청' },
  { id: 'sequential', label: '첫 요청이 끝난 뒤 두 번째 요청' },
];

export interface Config {
  readonly mode: Mode;
  readonly timing: Timing;
  readonly requests: readonly [Interval, Interval];
}

export type Verdict = 'created' | 'overlap' | 'conflict';

export interface Outcome {
  readonly label: string;
  readonly verdict: Verdict;
  /** 201 은 저장됐다는 뜻이고, overlap 은 저장됐지만 다른 예약과 겹친다는 뜻이에요 */
  readonly status: 201 | 409;
  readonly text: string;
}

export interface Result {
  readonly outcomes: readonly Outcome[];
  /** 저장이 끝난 뒤의 예약 전부 (기존 예약 포함) */
  readonly bookings: readonly Booking[];
  readonly free: readonly Interval[];
  /** 서로 겹치는 예약 쌍의 수. 0 이면 이중 예약이 없어요 */
  readonly overlapPairs: number;
}

export const REQUEST_LABELS = ['요청 A', '요청 B'] as const;

/** 요청 i 가 읽는 틱과 쓰는 틱. 같은 순간이면 둘 다 0 에 읽고 1 에 써요 */
const readTick = (timing: Timing, i: number) => (timing === 'concurrent' ? 0 : i * 2);
const writeTick = (timing: Timing, i: number) => readTick(timing, i) + 1;

const countOverlapPairs = (list: readonly Booking[]): number => {
  let pairs = 0;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (overlaps(list[i], list[j])) pairs += 1;
    }
  }
  return pairs;
};

export function simulate(config: Config): Result {
  const committed: Booking[] = [...EXISTING];
  const snapshots: (Booking[] | null)[] = [null, null];
  const seenConflict: boolean[] = [false, false];
  const outcomes: (Outcome | null)[] = [null, null];
  const ticks = [0, 1, 2, 3];

  for (const tick of ticks) {
    for (let i = 0; i < 2; i += 1) {
      if (config.mode === 'check' && readTick(config.timing, i) === tick) {
        const snap = committed.slice();
        snapshots[i] = snap;
        seenConflict[i] = snap.some((b) => overlaps(b, config.requests[i]));
      }
    }
    for (let i = 0; i < 2; i += 1) {
      if (writeTick(config.timing, i) !== tick) continue;
      outcomes[i] = write(config, committed, i, seenConflict[i]);
    }
  }

  const bookings = committed.map((b) => ({ ...b }));
  return {
    outcomes: outcomes.map((o) => o ?? { label: '', verdict: 'conflict', status: 409, text: '' }),
    bookings,
    free: freeWindows(OPEN, bookings),
    overlapPairs: countOverlapPairs(bookings),
  };
}

function write(config: Config, committed: Booking[], i: number, sawConflict: boolean): Outcome {
  const label = REQUEST_LABELS[i];
  const req = config.requests[i];
  const span = formatRange(req);

  if (config.mode === 'check' && sawConflict) {
    return {
      label,
      verdict: 'conflict',
      status: 409,
      text: `${label} · ${span} 확인할 때 겹치는 예약이 있었어요. INSERT 하지 않아요 → 409`,
    };
  }

  const clash = committed.find((b) => overlaps(b, req));
  if (config.mode === 'exclusion' && clash) {
    return { label, verdict: 'conflict', status: 409, text: `${label} · ${span} 배제 제약 위반 (23P01) → 409` };
  }

  committed.push({ owner: label, start: req.start, end: req.end });
  if (clash) {
    return {
      label,
      verdict: 'overlap',
      status: 201,
      text: `${label} · ${span} 저장됐어요 (201). ${clash.owner} 와 같은 시간이라 겹친 예약이 생겼어요`,
    };
  }
  return { label, verdict: 'created', status: 201, text: `${label} · ${span} 저장됐어요 (201)` };
}

/** 09:00~18:00 을 30분 단위로 나눈 선택지. from 이 있으면 그 뒤부터 골라요 */
export function timeOptions(from: number, to: number = OPEN.end): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let m = from; m <= to; m += 30) options.push({ value: String(m), label: formatTime(m) });
  return options;
}
