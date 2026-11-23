/**
 * 시각(instant)과 시간대별 벽시계 값을 바꾸는 순수 함수.
 * 계산은 전부 Intl API 로 해요. 시간대 규칙을 직접 적지 않아요.
 */

export const ZONES = [
  { id: 'Asia/Seoul', label: '서울' },
  { id: 'America/New_York', label: '뉴욕' },
  { id: 'Europe/London', label: '런던' },
] as const;

export type ZoneId = (typeof ZONES)[number]['id'];

export function zoneLabel(id: string): string {
  return ZONES.find((z) => z.id === id)?.label ?? id;
}

/** naive: 오프셋 없는 문자열. utc: Z 로 끝나는 문자열. offset: 작성자 오프셋을 붙인 문자열 */
export type Storage = 'naive' | 'utc' | 'offset';

export const STORAGE_OPTIONS: { value: Storage; label: string }[] = [
  { value: 'naive', label: '오프셋 없는 문자열' },
  { value: 'utc', label: 'UTC 문자열 (…Z)' },
  { value: 'offset', label: '오프셋 포함 (…+09:00)' },
];

export type DayRule = 'utc' | 'author' | 'viewer';

export const DAY_RULE_LABEL: Record<DayRule, string> = {
  utc: '서버 기준 (UTC 날짜)',
  author: '작성자 시간대 날짜',
  viewer: '보는 사람 시간대 날짜',
};

/** timeZone 이 'UTC' 면 DAY_RULE 의 utc 와 같아요 */
export type ScheduleMode = 'wall' | 'fixed';

export const SIMULATOR_DAYS = ['2026-03-07', '2026-03-08', '2026-03-09'] as const;

export const SCHEDULE_TIME = '09:00';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** 'YYYY-MM-DD HH:mm' 형식으로 그 시간대의 벽시계 값을 돌려줘요 */
export function formatZoned(instant: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** 그 순간 시간대가 UTC 보다 얼마나 앞서는지(밀리초) */
export function offsetMs(instant: Date, zone: string): number {
  const wall = Date.parse(`${formatZoned(instant, zone).replace(' ', 'T')}:00Z`);
  return wall - instant.getTime();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** '+09:00' · '-05:00' 형식 */
export function offsetLabel(instant: Date, zone: string): string {
  const minutes = Math.round(offsetMs(instant, zone) / MINUTE_MS);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * 벽시계 문자열('YYYY-MM-DDTHH:mm')을 그 시간대의 시각으로 바꿔요.
 * 없는 시각(서머타임 시작)은 전환 전 오프셋으로 계산해 앞으로 밀고,
 * 두 번 있는 시각(서머타임 종료)은 이른 쪽을 골라요. JS Date 의 로컬 해석과 같은 규칙이에요.
 */
export function zonedToInstant(wall: string, zone: string): Date {
  const guess = Date.parse(`${wall}:00Z`);
  const before = offsetMs(new Date(guess - DAY_MS), zone);
  const after = offsetMs(new Date(guess + DAY_MS), zone);
  const valid = [before, after].filter((o) => offsetMs(new Date(guess - o), zone) === o);
  if (valid.length === 0) return new Date(guess - before);
  return new Date(guess - Math.max(...valid));
}

export interface EventDraft {
  /** 작성자가 고른 시간대 */
  readonly authorZone: ZoneId;
  /** 작성자 시간대 기준 벽시계 값 'YYYY-MM-DDTHH:mm' */
  readonly wall: string;
}

/** 서버가 저장 방식에 따라 내려 주는 문자열 */
export function wireValue(event: EventDraft, storage: Storage): string {
  if (storage === 'naive') return `${event.wall}:00`;
  const instant = zonedToInstant(event.wall, event.authorZone);
  if (storage === 'utc') return instant.toISOString().replace('.000Z', 'Z');
  return `${event.wall}:00${offsetLabel(instant, event.authorZone)}`;
}

/** 보는 사람 기기가 해석한 순간. 오프셋이 없으면 보는 사람의 시간대로 읽혀요 */
export function instantSeenBy(event: EventDraft, storage: Storage, viewerZone: ZoneId): Date {
  if (storage === 'naive') return zonedToInstant(event.wall, viewerZone);
  return zonedToInstant(event.wall, event.authorZone);
}

/** 작성자가 뜻한 순간 */
export function intendedInstant(event: EventDraft): Date {
  return zonedToInstant(event.wall, event.authorZone);
}

/** 일별 집계에서 이 순간이 들어가는 날짜 'YYYY-MM-DD' */
export function dayBucket(instant: Date, rule: DayRule, event: EventDraft, viewerZone: ZoneId): string {
  const zone = rule === 'utc' ? 'UTC' : rule === 'author' ? event.authorZone : viewerZone;
  return formatZoned(instant, zone).slice(0, 10);
}

/**
 * 매일 SCHEDULE_TIME 에 보내는 알림의 발송 순간들.
 * wall: 시간대 이름으로 예약해서 날마다 그 지역의 9시에 맞춰요.
 * fixed: 처음 날 계산한 오프셋을 끝까지 고정해요.
 */
export function scheduleFires(days: readonly string[], zone: ZoneId, mode: ScheduleMode): Date[] {
  if (mode === 'wall') return days.map((d) => zonedToInstant(`${d}T${SCHEDULE_TIME}`, zone));
  const fixed = offsetMs(zonedToInstant(`${days[0]}T${SCHEDULE_TIME}`, zone), zone);
  return days.map((d) => new Date(Date.parse(`${d}T${SCHEDULE_TIME}:00Z`) - fixed));
}

/** 앞 알림과의 간격(시간). 첫 번째 항목은 null */
export function gapsInHours(fires: readonly Date[]): (number | null)[] {
  return fires.map((f, i) => (i === 0 ? null : (f.getTime() - fires[i - 1].getTime()) / HOUR_MS));
}
