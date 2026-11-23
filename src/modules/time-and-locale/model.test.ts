import { describe, expect, it } from 'vitest';
import {
  type EventDraft,
  dayBucket,
  formatZoned,
  gapsInHours,
  instantSeenBy,
  intendedInstant,
  offsetLabel,
  scheduleFires,
  type Storage,
  wireValue,
  type ZoneId,
  zonedToInstant,
} from './model';

const SEOUL: ZoneId = 'Asia/Seoul';
const NY: ZoneId = 'America/New_York';
const LONDON: ZoneId = 'Europe/London';

const iso = (d: Date) => d.toISOString();

/** 서울에서 작성한 2026-03-08 10시 이벤트 */
const seoulEvent: EventDraft = { authorZone: SEOUL, wall: '2026-03-08T10:00' };

describe('시각과 벽시계 시간', () => {
  it('같은 순간도 시간대에 따라 다른 벽시계 값으로 보여요', () => {
    const instant = new Date('2026-03-08T01:00:00Z');
    expect(formatZoned(instant, SEOUL)).toBe('2026-03-08 10:00');
    expect(formatZoned(instant, LONDON)).toBe('2026-03-08 01:00');
    expect(formatZoned(instant, NY)).toBe('2026-03-07 20:00');
  });

  it('오프셋은 그 날짜의 실제 규칙을 따라요', () => {
    expect(offsetLabel(new Date('2026-03-08T01:00:00Z'), NY)).toBe('-05:00');
    expect(offsetLabel(new Date('2026-03-08T12:00:00Z'), NY)).toBe('-04:00');
    expect(offsetLabel(new Date('2026-03-08T01:00:00Z'), SEOUL)).toBe('+09:00');
  });

  it('오프셋 없는 문자열은 보는 사람의 시간대로 읽혀서, 같은 값이 사람마다 다른 순간이 돼요', () => {
    expect(iso(instantSeenBy(seoulEvent, 'naive', SEOUL))).toBe('2026-03-08T01:00:00.000Z');
    expect(iso(instantSeenBy(seoulEvent, 'naive', NY))).toBe('2026-03-08T14:00:00.000Z');
    expect(iso(instantSeenBy(seoulEvent, 'naive', LONDON))).toBe('2026-03-08T10:00:00.000Z');
  });

  it('UTC 나 오프셋 포함 문자열은 누가 보든 작성자가 뜻한 같은 순간을 가리켜요', () => {
    const storages: Storage[] = ['utc', 'offset'];
    for (const storage of storages) {
      for (const zone of [SEOUL, NY, LONDON]) {
        expect(iso(instantSeenBy(seoulEvent, storage, zone))).toBe('2026-03-08T01:00:00.000Z');
      }
    }
    expect(iso(intendedInstant(seoulEvent))).toBe('2026-03-08T01:00:00.000Z');
  });

  it('서버가 보내는 문자열 형식에 따라 시간대 정보가 남거나 사라져요', () => {
    expect(wireValue(seoulEvent, 'naive')).toBe('2026-03-08T10:00:00');
    expect(wireValue(seoulEvent, 'utc')).toBe('2026-03-08T01:00:00Z');
    expect(wireValue(seoulEvent, 'offset')).toBe('2026-03-08T10:00:00+09:00');
  });
});

describe('서머타임 전환일', () => {
  it('뉴욕 3월 8일 2시 30분은 없는 시각이라 3시 30분으로 밀려요', () => {
    expect(formatZoned(zonedToInstant('2026-03-08T02:30', NY), NY)).toBe('2026-03-08 03:30');
  });

  it('뉴욕 11월 1일 1시 30분은 두 번 있어서 이른 쪽 순간을 골라요', () => {
    expect(iso(zonedToInstant('2026-11-01T01:30', NY))).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('매일 오전 9시 예약', () => {
  const DAYS = ['2026-03-07', '2026-03-08', '2026-03-09'];

  it('시간대 이름으로 예약하면 서머타임 날 발송 순간이 한 시간 당겨져요', () => {
    const fires = scheduleFires(DAYS, NY, 'wall');
    expect(fires.map(iso)).toEqual([
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ]);
    expect(gapsInHours(fires)).toEqual([null, 23, 24]);
  });

  it('처음 날 오프셋을 고정하면 뉴욕의 9시 알림이 서머타임 날 10시에 나가요', () => {
    const fires = scheduleFires(DAYS, NY, 'fixed');
    expect(fires.map((d) => formatZoned(d, NY))).toEqual(['2026-03-07 09:00', '2026-03-08 10:00', '2026-03-09 10:00']);
    expect(gapsInHours(fires)).toEqual([null, 24, 24]);
  });

  it('서울처럼 서머타임이 없는 곳은 두 방식의 결과가 같아요', () => {
    expect(scheduleFires(DAYS, SEOUL, 'wall').map(iso)).toEqual(scheduleFires(DAYS, SEOUL, 'fixed').map(iso));
    expect(gapsInHours(scheduleFires(DAYS, SEOUL, 'wall'))).toEqual([null, 24, 24]);
  });
});

describe('"오늘" 의 기준 — 일별 집계', () => {
  const event: EventDraft = { authorZone: SEOUL, wall: '2026-03-08T00:30' };

  it('같은 이벤트도 기준 시간대에 따라 다른 날짜로 집계돼요', () => {
    const instant = intendedInstant(event);
    expect(dayBucket(instant, 'utc', event, NY)).toBe('2026-03-07');
    expect(dayBucket(instant, 'author', event, NY)).toBe('2026-03-08');
    expect(dayBucket(instant, 'viewer', event, NY)).toBe('2026-03-07');
  });
});

describe('JS Date 파싱', () => {
  it('날짜만 있는 문자열은 UTC 자정으로 읽어요', () => {
    expect(Date.parse('2026-03-08')).toBe(Date.UTC(2026, 2, 8));
  });
});
