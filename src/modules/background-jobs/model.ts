/** 동기 처리: 요청 하나가 끝날 때까지 기다려요. 202 접수: 접수 응답 뒤 상태를 폴링해요. */
export type Mode = 'sync' | 'poll';

export const MODES: readonly Mode[] = ['sync', 'poll'];
export const MODE_LABEL: Record<Mode, string> = {
  sync: '동기 처리',
  poll: '202 접수 + 폴링',
};

export const JOB_MIN = 5;
export const JOB_MAX = 300;
export const POLL_MIN = 1;
export const POLL_MAX = 30;
export const GATEWAY_MIN = 10;
export const GATEWAY_MAX = 120;

export interface Params {
  /** 작업이 끝나기까지 걸리는 시간(초) */
  readonly jobSeconds: number;
  /** 상태를 조회하는 간격(초) */
  readonly pollSeconds: number;
  /** 앞단 게이트웨이가 응답을 기다리는 제한 시간(초) */
  readonly gatewaySeconds: number;
}

export interface Poll {
  /** 조회 시각(초). 접수 응답은 0초예요 */
  readonly at: number;
  readonly status: 'queued' | 'running' | 'succeeded';
}

export interface Outcome {
  /** 브라우저가 보낸 요청 수 */
  readonly requests: number;
  /** 사용자가 결과를 실제로 본 시각(초). 504 로 끝나면 null */
  readonly resultAt: number | null;
  /** 화면이 로딩을 멈추는 시각(초). 결과 또는 504 중 먼저 온 것 */
  readonly feDoneAt: number;
  /** 서버 안에서 작업이 끝나는 시각(초) */
  readonly serverDoneAt: number;
  /** 게이트웨이 제한 시간을 넘어 504 를 받았는지 */
  readonly timedOut: boolean;
  /** 504 뒤 사용자가 다시 누르면 같은 작업이 한 번 더 돌 수 있는지 */
  readonly retryRisk: boolean;
  /** 202 방식에서만 채워요. 접수 뒤 조회 기록 */
  readonly polls: readonly Poll[];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export function normalize(p: Params): Params {
  return {
    jobSeconds: clamp(p.jobSeconds, JOB_MIN, JOB_MAX),
    pollSeconds: clamp(p.pollSeconds, POLL_MIN, POLL_MAX),
    gatewaySeconds: clamp(p.gatewaySeconds, GATEWAY_MIN, GATEWAY_MAX),
  };
}

/** 요청 하나로 기다리는 방식. 게이트웨이 제한을 넘는 작업은 504 로 끝나요. */
export function runSync(input: Params): Outcome {
  const p = normalize(input);
  const timedOut = p.jobSeconds > p.gatewaySeconds;
  return {
    requests: 1,
    resultAt: timedOut ? null : p.jobSeconds,
    feDoneAt: timedOut ? p.gatewaySeconds : p.jobSeconds,
    serverDoneAt: p.jobSeconds,
    timedOut,
    retryRisk: timedOut,
    polls: [],
  };
}

/**
 * 202 로 접수하고 간격마다 상태를 조회하는 방식.
 * 조회 한 번 한 번은 짧게 끝나므로 게이트웨이 제한에 걸리지 않아요.
 * 요청 수는 접수 1회와 조회 횟수를 더한 값이에요.
 */
export function runPoll(input: Params): Outcome {
  const p = normalize(input);
  const count = Math.ceil(p.jobSeconds / p.pollSeconds);
  const polls: Poll[] = [{ at: 0, status: 'queued' }];
  for (let i = 1; i <= count; i++) {
    const at = i * p.pollSeconds;
    polls.push({ at, status: at >= p.jobSeconds ? 'succeeded' : 'running' });
  }
  const resultAt = count * p.pollSeconds;
  return {
    requests: 1 + count,
    resultAt,
    feDoneAt: resultAt,
    serverDoneAt: p.jobSeconds,
    timedOut: false,
    retryRisk: false,
    polls,
  };
}

export function run(mode: Mode, p: Params): Outcome {
  return mode === 'sync' ? runSync(p) : runPoll(p);
}
