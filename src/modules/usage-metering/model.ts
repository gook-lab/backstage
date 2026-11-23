export type Method = 'counter' | 'events' | 'events-fast';
export type Scenario = 'burst' | 'retry' | 'boundary' | 'near-limit';
export type Attribution = 'occurred' | 'arrived';
export type Period = 1 | 2;

export const METHODS: readonly Method[] = ['counter', 'events', 'events-fast'];
export const METHOD_LABEL: Record<Method, string> = {
  counter: '요청마다 DB 카운터',
  events: '이벤트 + 1분 집계',
  'events-fast': '이벤트 + 빠른 카운터 차단',
};

export const SCENARIOS: readonly Scenario[] = ['burst', 'retry', 'boundary', 'near-limit'];
export const SCENARIO_LABEL: Record<Scenario, string> = {
  burst: '호출 몰림 (1분 안에 90건)',
  retry: '이벤트 재전송 중복',
  boundary: '월말 23:59 이벤트가 00:01 도착',
  'near-limit': '한도 근처 동시 호출',
};

export const ATTRIBUTIONS: readonly Attribution[] = ['occurred', 'arrived'];
export const ATTRIBUTION_LABEL: Record<Attribution, string> = {
  occurred: '발생 시각 기준',
  arrived: '도착 시각 기준',
};

/** 시뮬레이터의 한 틱은 10초예요 */
export const TICK_SECONDS = 10;
/** 23:50:00 을 0틱으로 둬요 */
const START_SECONDS = 23 * 3600 + 50 * 60;
/** 00:00 — 청구 기간 경계 */
export const BOUNDARY = 60;
/** 00:03 — 이번 달 청구서 확정 시각 (예시) */
export const FINALIZE_AT = 78;
/** 00:20 — 시뮬레이터 끝 */
export const HORIZON = 180;
/** 1분 집계 (6틱) */
export const BATCH_TICKS = 6;

export const DEFAULT_LIMIT = 100;
export const LIMIT_MIN = 20;
export const LIMIT_MAX = 150;

export function clockLabel(tick: number): string {
  const sec = (START_SECONDS + tick * TICK_SECONDS) % 86400;
  return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function periodOf(tick: number): Period {
  return tick < BOUNDARY ? 1 : 2;
}

/** 호출 하나가 보낸 이벤트 한 번. 재전송이면 같은 호출의 이벤트가 여러 번 생겨요 */
export interface Emit {
  readonly emitAt: number;
  readonly arriveAt: number;
}

export interface Call {
  /** 멱등성 키 역할을 하는 호출 식별자 */
  readonly id: string;
  /** 호출이 실제로 일어난 틱 (발생 시각) */
  readonly at: number;
  readonly emits: readonly Emit[];
}

export interface Params {
  readonly method: Method;
  readonly scenario: Scenario;
  readonly limit: number;
  /** 멱등성 키로 같은 호출의 이벤트를 한 번만 세요 */
  readonly dedupe: boolean;
  readonly attribution: Attribution;
  /** 화면을 보는 시각 (틱) */
  readonly tick: number;
}

export interface Result {
  /** 허용된 호출 수 (중복 제외) */
  readonly accepted: number;
  /** 한도에 이미 닿은 뒤 허용된 호출 수 */
  readonly overLimit: number;
  /** 한도 안인데 막은 호출 수 */
  readonly falseBlocks: number;
  /** 화면에 보이는 숫자 (현재 달) */
  readonly screen: number;
  /** 같은 시점의 실제 호출 수 (현재 달) */
  readonly actual: number;
  /** 화면 숫자의 기준 시각 (틱). 집계 방식이면 마지막 집계 시각 */
  readonly snapTick: number;
  /** [이번 달 청구, 다음 달 청구] */
  readonly billed: readonly [number, number];
  /** 마감 뒤에 도착해 정정 항목으로 넘어간 건수 */
  readonly corrections: number;
  /** 발생 달과 다른 달에 든 건수 */
  readonly misplaced: number;
  /** 경계 시나리오의 23:59 호출이 든 달 */
  readonly focusBilled: Period | null;
}

interface Arrival {
  readonly callId: string;
  readonly at: number;
  readonly arriveAt: number;
}

interface Unit {
  readonly id: string;
  readonly at: number;
  readonly arriveAt: number;
  readonly billed: Period;
  readonly correction: boolean;
}

function once(id: string, at: number, arriveAt = at + 1): Call {
  return { id, at, emits: [{ emitAt: at, arriveAt }] };
}

export function scenarioCalls(s: Scenario): Call[] {
  switch (s) {
    case 'burst': {
      const base = Array.from({ length: 40 }, (_, i) => once(`b${i}`, Math.floor((i * 30) / 40)));
      const burst = Array.from({ length: 90 }, (_, i) => once(`x${i}`, 30 + Math.floor(i / 15)));
      return [...base, ...burst];
    }
    case 'retry':
      return Array.from({ length: 70 }, (_, i) => ({
        id: `r${i}`,
        at: i,
        emits: [
          { emitAt: i, arriveAt: i + 1 },
          { emitAt: i + 3, arriveAt: i + 4 },
        ],
      }));
    case 'boundary': {
      const steady = Array.from({ length: 60 }, (_, i) => {
        if (i >= 54 && i <= 58) return once(`m${i}`, i, i + 12);
        if (i === 59) return once(`m${i}`, i, 84);
        return once(`m${i}`, i);
      });
      const after = Array.from({ length: 30 }, (_, i) => once(`n${i}`, BOUNDARY + i));
      return [...steady, ...after];
    }
    case 'near-limit': {
      const base = Array.from({ length: 95 }, (_, i) => once(`a${i}`, Math.floor((i * 48) / 95)));
      const same = Array.from({ length: 20 }, (_, i) => once(`s${i}`, 50));
      return [...base, ...same];
    }
  }
}

/** 경계 시나리오에서 화면 설명에 쓰는 호출 (23:59 에 보낸 호출) */
export function focusCallId(s: Scenario): string | null {
  return s === 'boundary' ? 'm54' : null;
}

function buildUnits(p: Params, accepted: readonly Call[], arrivals: Arrival[]): Unit[] {
  if (p.method === 'counter') {
    return accepted.map((c) => ({ id: c.id, at: c.at, arriveAt: c.at, billed: periodOf(c.at), correction: false }));
  }
  const sorted = [...arrivals].sort((a, b) => a.arriveAt - b.arriveAt);
  const seen = new Set<string>();
  const out: Unit[] = [];
  for (const a of sorted) {
    if (p.dedupe) {
      if (seen.has(a.callId)) continue;
      seen.add(a.callId);
    }
    const occurred = periodOf(a.at);
    if (p.attribution === 'arrived') {
      out.push({ id: a.callId, at: a.at, arriveAt: a.arriveAt, billed: periodOf(a.arriveAt), correction: false });
    } else if (occurred === 1 && a.arriveAt > FINALIZE_AT) {
      out.push({ id: a.callId, at: a.at, arriveAt: a.arriveAt, billed: 2, correction: true });
    } else {
      out.push({ id: a.callId, at: a.at, arriveAt: a.arriveAt, billed: occurred, correction: false });
    }
  }
  return out;
}

export function simulate(p: Params): Result {
  const calls = scenarioCalls(p.scenario);
  const byTick: Call[][] = Array.from({ length: HORIZON + 1 }, () => []);
  for (const c of calls) if (c.at <= HORIZON) byTick[c.at].push(c);

  const arrivalsAt: Arrival[][] = Array.from({ length: HORIZON + 1 }, () => []);
  const allArrivals: Arrival[] = [];
  const accepted: Call[] = [];
  const aggUnique = new Set<string>();
  let aggTotal = 0;
  let aggVisible = 0;
  let overLimit = 0;
  let falseBlocks = 0;

  for (let t = 0; t <= HORIZON; t++) {
    for (const a of arrivalsAt[t]) {
      aggTotal++;
      aggUnique.add(a.callId);
    }
    if (t % BATCH_TICKS === 0) aggVisible = p.dedupe ? aggUnique.size : aggTotal;

    for (const c of byTick[t]) {
      const trueCount = accepted.length;
      const allowed = p.method === 'events' ? aggVisible < p.limit : trueCount < p.limit;
      if (allowed) {
        if (trueCount >= p.limit) overLimit++;
        accepted.push(c);
        if (p.method !== 'counter') {
          for (const e of c.emits) {
            if (e.arriveAt > HORIZON) continue;
            const a: Arrival = { callId: c.id, at: c.at, arriveAt: e.arriveAt };
            arrivalsAt[e.arriveAt].push(a);
            allArrivals.push(a);
          }
        }
      } else if (trueCount < p.limit) {
        falseBlocks++;
      }
    }
  }

  const units = buildUnits(p, accepted, allArrivals);
  const snapTick = p.method === 'counter' ? p.tick : p.tick - (p.tick % BATCH_TICKS);
  const cur = periodOf(p.tick);
  const screen = units.filter((u) => u.arriveAt <= snapTick && u.billed === cur).length;
  const actual = accepted.filter((c) => c.at <= p.tick && periodOf(c.at) === cur).length;
  const focus = focusCallId(p.scenario);
  const focusUnit = focus ? units.find((u) => u.id === focus) : undefined;

  return {
    accepted: accepted.length,
    overLimit,
    falseBlocks,
    screen,
    actual,
    snapTick,
    billed: [units.filter((u) => u.billed === 1).length, units.filter((u) => u.billed === 2).length],
    corrections: units.filter((u) => u.correction).length,
    misplaced: units.filter((u) => u.billed !== periodOf(u.at)).length,
    focusBilled: focusUnit ? focusUnit.billed : null,
  };
}
