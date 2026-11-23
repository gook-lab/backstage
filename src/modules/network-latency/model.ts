/** 연결 설정이 어떤 프로토콜 조합인지 */
export type Protocol = 'h1-tls12' | 'h2-tls13' | 'h3';
/**
 * new: 연결을 처음 여는 경우
 * reused: 이미 열린 연결을 그대로 쓰는 경우
 * resumed: 예전 세션을 재개하는 경우 (TLS 세션 재개 · 0-RTT)
 */
export type ConnState = 'new' | 'reused' | 'resumed';

export interface Config {
  /** 사용자와 오리진 사이 RTT (ms). 예시 값이에요 */
  readonly rtt: number;
  readonly protocol: Protocol;
  readonly state: ConnState;
  /** CDN 엣지를 쓰는지 */
  readonly edge: boolean;
  /** 엣지에 응답이 있는지 (엣지를 쓸 때만 의미가 있어요) */
  readonly edgeHit: boolean;
  /** 첫 화면에 필요한 요청 수 */
  readonly count: number;
  /** 앞 응답을 기다려야 다음 요청을 보낼 수 있는 단계 수 (병렬일 때 왕복 수가 돼요) */
  readonly depth: number;
  /** true 면 같은 단계 요청을 한꺼번에 보내요. false 면 하나씩 보내요 */
  readonly parallel: boolean;
}

export interface Step {
  readonly label: string;
  readonly ms: number;
  /** 이 단계가 끝나는 시각 (ms) */
  readonly cumulative: number;
}

export interface Timeline {
  readonly steps: readonly Step[];
  /** 첫 화면 데이터가 도착하는 시각 (ms) */
  readonly total: number;
  /** 연결 설정 왕복 + 요청 왕복 */
  readonly roundTrips: number;
  readonly setupRtts: number;
  readonly rounds: number;
}

/** 예시 값: 사용자 가까이 있는 엣지까지 RTT */
export const EDGE_RTT = 20;
/** 예시 값: 요청 한 번의 서버 처리 시간 */
export const SERVER_MS = 30;
/** 예시 값: 같은 나라 · 가까운 해외 · 먼 해외 구간 */
export const RTT_PRESETS: readonly number[] = [20, 80, 160, 250];
export const MAX_REQUESTS = 5;

export const PROTOCOLS: readonly { value: Protocol; label: string; hint: string }[] = [
  {
    value: 'h1-tls12',
    label: 'HTTP/1.1 + TLS 1.2',
    hint: 'TCP 위에서 TLS 1.2 를 써요. 새 연결마다 왕복이 가장 많아요.',
  },
  {
    value: 'h2-tls13',
    label: 'HTTP/2 + TLS 1.3',
    hint: 'TCP 위에서 TLS 1.3 을 써요. 한 연결에서 여러 요청을 나눠 보내요.',
  },
  {
    value: 'h3',
    label: 'HTTP/3 (QUIC)',
    hint: 'QUIC 위에서 돌아요. 전송과 TLS 핸드셰이크를 한 번에 맞춰요.',
  },
];

export const STATES: readonly { value: ConnState; label: string; hint: string }[] = [
  { value: 'new', label: '새 연결', hint: '연결을 처음부터 맺어요.' },
  { value: 'reused', label: '연결 재사용', hint: '이미 열린 연결로 바로 요청해요.' },
  {
    value: 'resumed',
    label: '세션 재개',
    hint: '예전 세션으로 연결 설정을 줄여요. 0-RTT 는 첫 요청을 설정과 함께 보내요.',
  },
];

/**
 * 첫 요청이 나가기 전에 필요한 왕복 수예요.
 * TCP 3-way 핸드셰이크는 1왕복이에요. TLS 1.2 전체 핸드셰이크는 2왕복, 재개는 1왕복이에요.
 * TLS 1.3 전체 핸드셰이크는 1왕복이고, 0-RTT 재개는 첫 요청을 첫 메시지에 실어 보내요.
 * QUIC 은 전송과 TLS 를 합쳐 1왕복이고, 0-RTT 재개는 0왕복이에요.
 */
export function setupRtts(protocol: Protocol, state: ConnState): number {
  if (state === 'reused') return 0;
  if (protocol === 'h1-tls12') return state === 'new' ? 3 : 2;
  if (protocol === 'h2-tls13') return state === 'new' ? 2 : 1;
  return state === 'new' ? 1 : 0;
}

export function clampDepth(count: number, depth: number): number {
  return Math.min(Math.max(1, depth), Math.max(1, count));
}

/** 요청 한 번이 왕복에 걸리는 시간. 엣지 미스면 엣지가 오리진까지 한 번 더 다녀와요 */
export function roundCost(c: Pick<Config, 'rtt' | 'edge' | 'edgeHit'>): number {
  if (!c.edge) return c.rtt;
  return EDGE_RTT + (c.edgeHit ? 0 : c.rtt);
}

/**
 * 첫 화면 데이터까지 걸리는 시간을 단계별로 쌓아요.
 * 엣지 쪽 연결 설정은 가까운 엣지와 맺는다고 보고, 엣지 → 오리진 연결은 이미 열려 있다고 가정해요.
 */
export function buildTimeline(c: Config): Timeline {
  const count = Math.max(1, c.count);
  const depth = clampDepth(count, c.depth);
  const base = c.edge ? EDGE_RTT : c.rtt;
  const setup = setupRtts(c.protocol, c.state);
  const rounds = c.parallel ? depth : count;
  const perRound = roundCost({ rtt: c.rtt, edge: c.edge, edgeHit: c.edgeHit }) + SERVER_MS;

  const steps: Step[] = [];
  let cumulative = 0;
  if (setup > 0) {
    const ms = setup * base;
    cumulative += ms;
    steps.push({ label: `연결 설정 ${setup}왕복`, ms, cumulative });
  }
  for (let i = 1; i <= rounds; i++) {
    cumulative += perRound;
    steps.push({ label: `요청 ${i}단계 (왕복 + 서버)`, ms: perRound, cumulative });
  }
  return { steps, total: cumulative, roundTrips: setup + rounds, setupRtts: setup, rounds };
}

export interface CompareRow {
  readonly protocol: Protocol;
  readonly state: ConnState;
  readonly total: number;
  readonly roundTrips: number;
}

/** 같은 RTT · 요청 설정에서 프로토콜과 연결 상태만 바꿔 비교해요 */
export function compareRows(base: Config): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const p of PROTOCOLS) {
    for (const s of STATES) {
      const t = buildTimeline({ ...base, protocol: p.value, state: s.value });
      rows.push({ protocol: p.value, state: s.value, total: t.total, roundTrips: t.roundTrips });
    }
  }
  return rows;
}
