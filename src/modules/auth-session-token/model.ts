/**
 * 만료된 액세스 토큰으로 동시에 나간 요청들이 401 을 받은 뒤 갱신을 어떻게 처리하는지 본떠요.
 * 시간은 시드(seed)로 정한 지연 값을 써서 같은 입력이면 항상 같은 결과가 나와요.
 */

/** each: 401 을 받은 요청마다 각자 갱신해요. shared: 갱신을 하나로 묶어 기다려요 */
export type Strategy = 'each' | 'shared';

export const MAX_REQUESTS = 8;

export interface Options {
  /** 동시에 나간 요청 수 (1~8) */
  readonly requests: number;
  readonly strategy: Strategy;
  /** 갱신 때마다 리프레시 토큰을 새로 발급하고 이전 토큰을 무효화해요 (회전) */
  readonly rotation: boolean;
  /** 회전 중에 무효화된 토큰이 다시 제출되면 세션 전체를 끊어요 (재사용 감지). 회전이 꺼지면 의미가 없어요 */
  readonly reuseDetection: boolean;
  /** 지연 값을 정하는 시드. 같은 시드면 같은 타이밍이에요 */
  readonly seed: number;
}

export interface LogLine {
  readonly t: number;
  readonly text: string;
}

export interface Outcome {
  /** 서버로 나간 갱신 요청 수 */
  readonly refreshCalls: number;
  /** 갱신에 성공한 횟수 */
  readonly refreshOk: number;
  /** 이미 무효화된 리프레시 토큰이 제출된 횟수 */
  readonly staleTokens: number;
  /** 클라이언트가 세션 종료 응답을 받아 로그아웃했는지 */
  readonly sessionEnded: boolean;
  /** 원래 요청 중 최종적으로 성공한 수 */
  readonly requestsOk: number;
  /** 원래 요청 중 최종적으로 실패한 수 */
  readonly requestsFailed: number;
  readonly log: readonly LogLine[];
}

/** mulberry32: 작은 결정적 난수 생성기. 0 이상 1 미만 값을 돌려줘요 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Kind = 'unauthorized' | 'refreshSend' | 'serverRecv' | 'clientRecv' | 'retry';

type ServerResult =
  | { readonly ok: true; readonly rt: number; readonly at: number }
  | { readonly ok: false; readonly reason: 'stale' | 'killed' | 'dead' };

interface Ev {
  readonly t: number;
  readonly seq: number;
  readonly kind: Kind;
  readonly i: number;
  readonly presented?: number;
  readonly result?: ServerResult;
}

const SERVER_PROCESSING_MS = 10;
const ARRIVE_401_BASE_MS = 100;

export function simulate(opts: Options): Outcome {
  const n = Math.min(MAX_REQUESTS, Math.max(1, Math.floor(opts.requests)));
  const rand = mulberry32(opts.seed);

  // 시드 순서대로 지연을 뽑아요. 401 도착, 요청 왕복, 응답 왕복
  const arrive401: number[] = [];
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < n; i++) {
    arrive401.push(ARRIVE_401_BASE_MS + Math.floor(rand() * 40));
    up.push(40 + Math.floor(rand() * 20));
    down.push(40 + Math.floor(rand() * 20));
  }

  // 서버 상태
  let serverCurrent = 0;
  let nextRt = 1;
  let atSeq = 0;
  const retired = new Set<number>();
  let serverKilled = false;
  let staleTokens = 0;

  // 클라이언트 상태
  let clientRt = 0;
  let currentAt = 0; // 0 은 만료된 액세스 토큰
  let clientEnded = false;
  let inFlight = false;
  let waiters: number[] = [];

  // 집계
  let refreshCalls = 0;
  let refreshOk = 0;
  let requestsOk = 0;
  let requestsFailed = 0;
  const log: LogLine[] = [];

  const queue: Ev[] = [];
  let seq = 0;
  const push = (e: Omit<Ev, 'seq'>) => {
    queue.push({ ...e, seq: seq++ });
    queue.sort((a, b) => a.t - b.t || a.seq - b.seq);
  };

  const name = (i: number) => `요청 ${i + 1}`;
  const note = (t: number, text: string) => log.push({ t, text });

  const serverHandle = (presented: number): ServerResult => {
    if (serverKilled) return { ok: false, reason: 'dead' };
    if (presented === serverCurrent) {
      if (opts.rotation) {
        retired.add(presented);
        serverCurrent = nextRt++;
      }
      atSeq += 1;
      return { ok: true, rt: serverCurrent, at: atSeq };
    }
    // 이미 회전으로 무효화된 토큰이 다시 왔어요
    staleTokens += 1;
    if (opts.rotation && opts.reuseDetection) {
      serverKilled = true;
      return { ok: false, reason: 'killed' };
    }
    return { ok: false, reason: 'stale' };
  };

  const finish = (i: number, t: number, ok: boolean, why: string) => {
    if (ok) requestsOk += 1;
    else requestsFailed += 1;
    note(t, `${name(i)} ${why}`);
  };

  for (let i = 0; i < n; i++) push({ t: arrive401[i], kind: 'unauthorized', i });

  while (queue.length > 0) {
    const ev = queue.shift() as Ev;
    const { t, i } = ev;

    if (ev.kind === 'unauthorized') {
      // 모든 원래 요청은 만료된 토큰(0)으로 나갔어요
      if (clientEnded) {
        finish(i, t, false, '401 을 받았지만 이미 로그아웃 상태라 실패해요');
      } else if (opts.strategy === 'each') {
        push({ t, kind: 'refreshSend', i });
      } else if (inFlight) {
        waiters.push(i);
        note(t, `${name(i)} 401 — 진행 중인 갱신을 기다려요`);
      } else if (currentAt !== 0) {
        note(t, `${name(i)} 401 — 이미 새 토큰이 있어 갱신 없이 재시도해요`);
        push({ t, kind: 'retry', i });
      } else {
        inFlight = true;
        push({ t, kind: 'refreshSend', i });
      }
    } else if (ev.kind === 'refreshSend') {
      if (clientEnded) {
        finish(i, t, false, '로그아웃 상태라 갱신을 보내지 않아요');
        continue;
      }
      refreshCalls += 1;
      const presented = clientRt;
      note(t, `${name(i)} 갱신 요청 — 리프레시 토큰 #${presented} 제출`);
      push({ t: t + up[i], kind: 'serverRecv', i, presented });
    } else if (ev.kind === 'serverRecv') {
      const result = serverHandle(ev.presented ?? 0);
      const msg = result.ok
        ? `서버 — 새 토큰 발급(리프레시 #${result.rt})`
        : result.reason === 'stale'
          ? '서버 — 무효화된 토큰이라 거절'
          : result.reason === 'killed'
            ? '서버 — 무효화된 토큰 재사용 감지, 세션 전체 폐기'
            : '서버 — 이미 폐기된 세션이라 거절';
      note(t, `${name(i)} ${msg}`);
      push({ t: t + SERVER_PROCESSING_MS + down[i], kind: 'clientRecv', i, result });
    } else if (ev.kind === 'clientRecv') {
      const result = ev.result as ServerResult;
      if (result.ok) {
        refreshOk += 1;
        clientRt = result.rt;
        currentAt = result.at;
        if (opts.strategy === 'each') {
          push({ t, kind: 'retry', i });
        } else {
          inFlight = false;
          for (const j of [i, ...waiters]) push({ t, kind: 'retry', i: j });
          waiters = [];
        }
      } else {
        if (result.reason === 'killed' || result.reason === 'dead') clientEnded = true;
        if (opts.strategy === 'each') {
          finish(i, t, false, '갱신에 실패해 요청이 끝났어요');
        } else {
          inFlight = false;
          for (const j of [i, ...waiters]) finish(j, t, false, '갱신에 실패해 요청이 끝났어요');
          waiters = [];
        }
      }
    } else {
      // retry: 새 액세스 토큰으로 원래 요청을 다시 보내요
      if (clientEnded) finish(i, t, false, '재시도했지만 로그아웃 상태예요');
      else finish(i, t, true, '재시도 성공');
    }
  }

  return {
    refreshCalls,
    refreshOk,
    staleTokens,
    sessionEnded: clientEnded,
    requestsOk,
    requestsFailed,
    log,
  };
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly options: Omit<Options, 'requests' | 'seed'>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'each-plain',
    label: '각자 갱신 · 회전 없음',
    options: { strategy: 'each', rotation: false, reuseDetection: false },
  },
  {
    id: 'each-rotate',
    label: '각자 갱신 · 회전',
    options: { strategy: 'each', rotation: true, reuseDetection: false },
  },
  {
    id: 'each-detect',
    label: '각자 갱신 · 회전 · 재사용 감지',
    options: { strategy: 'each', rotation: true, reuseDetection: true },
  },
  {
    id: 'shared-detect',
    label: '하나로 묶어 갱신 · 회전 · 재사용 감지',
    options: { strategy: 'shared', rotation: true, reuseDetection: true },
  },
];
