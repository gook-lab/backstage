/** 접속 상태 판단 방식. ttl: 하트비트 + 만료 키 · event: 연결 종료 이벤트만 믿음 */
export type Method = 'ttl' | 'event';
/** 키 단위. per-connection: 기기 · 탭마다 키 하나 · per-user: 사용자당 키 하나 */
export type KeyMode = 'per-connection' | 'per-user';
export type Scenario = 'clean' | 'crash' | 'blip' | 'second';

export const HORIZON = 120;

export interface Params {
  method: Method;
  /** 하트비트 간격(초). event 방식에서는 쓰지 않아요 */
  hbSec: number;
  /** 키 TTL(초) */
  ttlSec: number;
  /** 서버 판단이 오프라인이어도 화면에 온라인을 유지하는 시간(초) */
  graceSec: number;
  /** 마지막 접속 시각 기록 주기(초). 0 이면 기록 시점마다 씀 */
  writeSec: number;
  keyMode: KeyMode;
  scenario: Scenario;
}

export interface Conn {
  id: string;
  /** 연결이 열린 초 (포함) */
  start: number;
  /** 연결이 끝나는 초 (제외) */
  end: number;
  /** true 면 종료 프레임을 보내요. false 면 신호 없이 사라져요 */
  clean: boolean;
  /** 신호 없이 끊긴 구간 [from, to) */
  gap?: readonly [number, number];
}

export const SCENARIO_LABEL: Record<Scenario, string> = {
  clean: '정상 종료',
  crash: '앱 강제 종료',
  blip: '5초 와이파이 끊김',
  second: '두 번째 기기 접속',
};

export const SCENARIO_HINT: Record<Scenario, string> = {
  clean: '0~59초 사이 종료 프레임을 보내고 앱을 닫아요.',
  crash: '60초에 아무 신호 없이 사라져요. 종료 프레임도 하트비트도 없어요.',
  blip: '40~44초 동안 기기가 신호 없이 끊겼다가 45초에 다시 붙어요.',
  second: '0~59초에 기기 A가 종료하고, 35초부터 기기 B가 계속 접속해 있어요.',
};

export const SCENARIOS: Record<Scenario, Conn[]> = {
  clean: [{ id: 'A', start: 0, end: 60, clean: true }],
  crash: [{ id: 'A', start: 0, end: 60, clean: false }],
  blip: [{ id: 'A', start: 0, end: HORIZON, clean: true, gap: [40, 45] }],
  second: [
    { id: 'A', start: 0, end: 60, clean: true },
    { id: 'B', start: 35, end: HORIZON, clean: true },
  ],
};

export interface Tick {
  t: number;
  /** 기기 기준으로 실제 연결이 살아 있나요 */
  real: boolean;
  /** 서버가 키를 보고 판단한 결과 */
  server: boolean;
  /** 화면에 보이는 상태 (유예 적용 후) */
  display: boolean;
}

export interface Range {
  from: number;
  /** 제외 끝 */
  to: number;
}

export interface Result {
  ticks: Tick[];
  /** 실제로는 끊겼는데 화면에 온라인으로 보인 초 */
  staleOnline: number;
  /** 실제로는 연결돼 있는데 화면에 오프라인으로 보인 초 */
  falseOffline: number;
  /** 화면 상태가 바뀐 횟수 */
  flips: number;
  /** 마지막 접속 시각 기록 쓰기 횟수 */
  writes: number;
  /** 실제 마지막 연결 초 - 저장된 마지막 접속 초 */
  lastSeenError: number;
  staleRanges: Range[];
  falseRanges: Range[];
}

function toRanges(ticks: Tick[], pick: (k: Tick) => boolean): Range[] {
  const out: Range[] = [];
  for (const k of ticks) {
    if (!pick(k)) continue;
    const last = out[out.length - 1];
    if (last && last.to === k.t) last.to = k.t + 1;
    else out.push({ from: k.t, to: k.t + 1 });
  }
  return out;
}

export function simulate(p: Params): Result {
  const conns = SCENARIOS[p.scenario];
  /** 키 → 이 초부터는 없는 키. Infinity 는 만료 없음 */
  const expiry = new Map<string, number>();
  const lastSent = new Map<string, number>();
  const wasConnected = new Map<string, boolean>();
  const keyOf = (c: Conn) => (p.keyMode === 'per-user' ? 'user' : `conn:${c.id}`);

  const ticks: Tick[] = [];
  let writes = 0;
  let lastWrite = -Infinity;
  let lastWriteValue = -1;
  let lastRealConnected = -1;
  let streak = 0;

  const write = (t: number, value: number) => {
    writes += 1;
    lastWrite = t;
    lastWriteValue = value;
  };

  for (let t = 0; t < HORIZON; t++) {
    const state = conns.map((c) => {
      const inGap = c.gap !== undefined && t >= c.gap[0] && t < c.gap[1];
      const connected = t >= c.start && t < c.end && !inGap;
      return { c, connected };
    });
    const anyConnected = state.some((s) => s.connected);

    for (const { c, connected } of state) {
      const key = keyOf(c);

      // 정상 종료: 종료 프레임을 받은 서버가 키를 지워요
      if (c.clean && t === c.end) {
        expiry.delete(key);
        if (!anyConnected) write(t, t - 1);
      }

      if (connected) {
        const prev = wasConnected.get(c.id) ?? false;
        const sent = lastSent.get(c.id) ?? -Infinity;
        const due = !prev || (p.method === 'ttl' && t - sent >= p.hbSec);
        if (due) {
          lastSent.set(c.id, t);
          expiry.set(key, p.method === 'ttl' ? t + p.ttlSec : Infinity);
          if (p.writeSec === 0 || t - lastWrite >= p.writeSec) write(t, t);
        }
      }
      wasConnected.set(c.id, connected);
    }

    if (anyConnected) lastRealConnected = t;
    const server = [...expiry.values()].some((e) => e > t);
    if (server) streak = 0;
    else streak += 1;
    const display = server || streak <= p.graceSec;
    ticks.push({ t, real: anyConnected, server, display });
  }

  let flips = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i].display !== ticks[i - 1].display) flips += 1;
  }

  return {
    ticks,
    staleOnline: ticks.filter((k) => k.display && !k.real).length,
    falseOffline: ticks.filter((k) => !k.display && k.real).length,
    flips,
    writes,
    lastSeenError: lastRealConnected - lastWriteValue,
    staleRanges: toRanges(ticks, (k) => k.display && !k.real),
    falseRanges: toRanges(ticks, (k) => !k.display && k.real),
  };
}

export function formatRanges(ranges: Range[]): string {
  return ranges.map((r) => (r.to - r.from === 1 ? `${r.from}초` : `${r.from}~${r.to - 1}초`)).join(', ');
}
