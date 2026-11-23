import { describe, expect, it } from 'vitest';
import {
  EXISTING,
  OPEN,
  freeWindows,
  overlaps,
  simulate,
  type Config,
  type Interval,
  type Mode,
  type Timing,
} from './model';

const at = (h: number, m = 0): number => h * 60 + m;
const span = (sh: number, sm: number, eh: number, em: number): Interval => ({ start: at(sh, sm), end: at(eh, em) });

const DEFAULT_REQUESTS = [span(14, 0, 15, 0), span(14, 30, 15, 30)] as const;

function run(mode: Mode, timing: Timing, requests: readonly [Interval, Interval] = DEFAULT_REQUESTS) {
  const config: Config = { mode, timing, requests };
  return simulate(config);
}

describe('구간 겹침 조건', () => {
  it('14:00~15:00 과 14:30~15:30 은 겹친다', () => {
    expect(overlaps(span(14, 0, 15, 0), span(14, 30, 15, 30))).toBe(true);
  });

  it('15:00 에 끝나는 예약과 15:00 에 시작하는 예약은 겹치지 않는다', () => {
    expect(overlaps(span(14, 0, 15, 0), span(15, 0, 16, 0))).toBe(false);
    expect(overlaps(span(15, 0, 16, 0), span(14, 0, 15, 0))).toBe(false);
  });

  it('한 구간이 다른 구간을 완전히 감싸면 겹친다', () => {
    expect(overlaps(span(9, 0, 18, 0), span(10, 0, 11, 0))).toBe(true);
  });
});

describe('빈 시간 계산', () => {
  it('예약이 없으면 영업시간 전체가 빈 시간이다', () => {
    expect(freeWindows(OPEN, [])).toEqual([OPEN]);
  });

  it('맞닿은 두 예약 사이에는 빈 시간이 생기지 않는다', () => {
    const booked = [span(10, 0, 11, 0), span(11, 0, 12, 0)];
    expect(freeWindows(OPEN, booked)).toEqual([
      { start: at(9), end: at(10) },
      { start: at(12), end: at(18) },
    ]);
  });

  it('영업시간 밖으로 나간 예약은 영업시간 안쪽만 잘라 낸다', () => {
    const booked = [span(8, 0, 9, 30)];
    expect(freeWindows(OPEN, booked)).toEqual([{ start: at(9, 30), end: at(18) }]);
  });

  it('겹치는 예약이 있어도 가장 늦은 끝 시각 뒤부터 빈 시간을 센다', () => {
    const booked = [span(14, 0, 15, 0), span(14, 30, 15, 30)];
    expect(freeWindows(OPEN, booked)).toEqual([
      { start: at(9), end: at(14) },
      { start: at(15, 30), end: at(18) },
    ]);
  });
});

describe('기존 예약과 맞닿은 시작은 막히지 않는다', () => {
  it('기존 예약 B 가 13:00~14:00 이므로 14:00 시작 요청은 모든 방식에서 저장된다', () => {
    const modes: Mode[] = ['none', 'check', 'exclusion'];
    for (const mode of modes) {
      const result = run(mode, 'sequential', [span(14, 0, 15, 0), span(16, 0, 16, 30)]);
      expect(result.outcomes[0].status).toBe(201);
      expect(result.outcomes[0].verdict).toBe('created');
    }
  });

  it('기존 예약 C 가 끝나는 17:00 에 시작하는 예약은 배제 제약에서도 통과한다', () => {
    const result = run('exclusion', 'concurrent', [span(17, 0, 18, 0), span(9, 0, 10, 0)]);
    expect(result.outcomes.map((o) => o.verdict)).toEqual(['created', 'created']);
    expect(result.overlapPairs).toBe(0);
  });
});

describe('확인 없음', () => {
  it('두 요청이 같은 순간에 들어오면 둘 다 201 로 저장되고 겹친 예약 쌍이 생긴다', () => {
    const result = run('none', 'concurrent');
    expect(result.outcomes.map((o) => o.status)).toEqual([201, 201]);
    expect(result.outcomes[1].verdict).toBe('overlap');
    expect(result.overlapPairs).toBe(1);
  });

  it('순서대로 들어와도 확인이 없으니 두 번째 요청이 겹친 예약을 만든다', () => {
    const result = run('none', 'sequential');
    expect(result.outcomes[1].verdict).toBe('overlap');
    expect(result.overlapPairs).toBe(1);
  });
});

describe('확인 후 삽입', () => {
  it('같은 순간에 들어오면 둘 다 빈 시간을 보고 저장해 겹친 예약이 생긴다', () => {
    const result = run('check', 'concurrent');
    expect(result.outcomes.map((o) => o.verdict)).toEqual(['created', 'overlap']);
    expect(result.overlapPairs).toBe(1);
  });

  it('순서대로 들어오면 두 번째 요청이 확인에서 막혀 409 가 된다', () => {
    const result = run('check', 'sequential');
    expect(result.outcomes[1].status).toBe(409);
    expect(result.outcomes[1].verdict).toBe('conflict');
    expect(result.overlapPairs).toBe(0);
  });
});

describe('배제 제약', () => {
  it.each(['concurrent', 'sequential'] as const)('%s 요청이어도 겹치는 두 번째 예약은 409 가 된다', (timing) => {
    const result = run('exclusion', timing);
    expect(result.outcomes[0].status).toBe(201);
    expect(result.outcomes[1].status).toBe(409);
    expect(result.outcomes[1].text).toContain('23P01');
    expect(result.overlapPairs).toBe(0);
  });

  it('경계가 맞닿은 두 예약(14:00~15:00, 15:00~16:00)은 같은 순간에 들어와도 둘 다 저장된다', () => {
    const result = run('exclusion', 'concurrent', [span(14, 0, 15, 0), span(15, 0, 16, 0)]);
    expect(result.outcomes.map((o) => o.status)).toEqual([201, 201]);
    expect(result.overlapPairs).toBe(0);
  });

  it('409 가 난 요청은 저장 목록에 들어가지 않는다', () => {
    const result = run('exclusion', 'sequential');
    const names = result.bookings.map((b) => b.owner);
    expect(names).not.toContain('요청 B');
    expect(names).toContain('요청 A');
    expect(result.bookings).toHaveLength(EXISTING.length + 1);
  });
});

describe('결과 요약', () => {
  it('배제 제약으로 저장한 결과의 빈 시간은 저장된 예약만 뺀 값이다', () => {
    const result = run('exclusion', 'sequential');
    expect(result.free).toEqual(freeWindows(OPEN, result.bookings));
    expect(result.free).toContainEqual({ start: at(15), end: at(16) });
  });
});
