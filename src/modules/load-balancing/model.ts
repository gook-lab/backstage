/**
 * 배포 한 번을 시간 축에서 흉내 내는 순수 모델. 단위는 초예요.
 *
 * 가정:
 * - 배포는 DEPLOY_AT에 시작해요. 이때 교체 대상 서버(서버 1)는 헬스 체크에서 실패하기 시작해요.
 * - 로드밸런서는 헬스 체크 실패가 UNHEALTHY_THRESHOLD번 쌓이면(간격 × 횟수) 서버를 목록에서 빼요.
 * - 종료 신호(SIGTERM)는 preStopSec 뒤에 보내요. 그 전까지 서버는 평소처럼 응답해요.
 * - 새 서버는 NEW_SERVER_READY_AFTER초 뒤 준비가 끝나고, 그때 목록에 들어가요.
 */

export const DEPLOY_AT = 10;
export const HORIZON = 90;
export const ARRIVAL_STEP = 0.5;
export const UNHEALTHY_THRESHOLD = 2;
export const NEW_SERVER_READY_AFTER = 10;

export interface Params {
  /** 교체 대상을 포함한 옛 서버 수 (1~4) */
  servers: number;
  /** 헬스 체크 간격 (5~30초) */
  healthIntervalSec: number;
  /** 배포 시작부터 SIGTERM까지 기다리는 시간 (0~30초). 그동안 서버는 평소처럼 응답해요 */
  preStopSec: number;
  /** SIGTERM 뒤 프로세스가 진행 중 요청을 기다리는 시간 (0~60초). graceful 일 때만 써요 */
  stopGraceSec: number;
  /** 로드밸런서가 등록 해제된 서버의 진행 중 요청을 기다려 주는 시간 (0~60초) */
  drainSec: number;
  /** 요청 하나가 걸리는 시간 (1~20초) */
  requestSec: number;
  /** true: SIGTERM 뒤 새 요청은 503으로 거절하고 진행 중 요청을 마무리해요. false: SIGTERM과 함께 바로 내려가요 */
  graceful: boolean;
}

export type Status = 200 | 502 | 503;

export interface Lane {
  label: string;
  version: 'old' | 'new';
  /** 교체 대상인지 */
  replaced: boolean;
}

export interface Shot {
  id: number;
  /** 요청이 들어온 시각(초) */
  at: number;
  /** Lane 배열의 인덱스 */
  lane: number;
  status: Status;
  reason: string;
}

export interface Timeline {
  lanes: Lane[];
  shots: Shot[];
  counts: Record<Status, number>;
  /** 종료 신호 시각 */
  termAt: number;
  /** 로드밸런서가 교체 대상을 목록에서 빼는 시각 */
  noticeAt: number;
  /** 프로세스가 내려가는 시각 */
  exitAt: number;
  /** 처리 중 요청을 끊는 시각 */
  cutAt: number;
}

export const PRESETS: readonly { id: string; label: string; params: Params }[] = [
  {
    id: 'default',
    label: '기본 설정',
    params: {
      servers: 3,
      healthIntervalSec: 10,
      preStopSec: 0,
      stopGraceSec: 30,
      drainSec: 30,
      requestSec: 4,
      graceful: true,
    },
  },
  {
    id: 'prestop',
    label: '종료 신호 전에 기다리기',
    params: {
      servers: 3,
      healthIntervalSec: 10,
      preStopSec: 20,
      stopGraceSec: 30,
      drainSec: 30,
      requestSec: 4,
      graceful: true,
    },
  },
  {
    id: 'kill',
    label: '바로 종료',
    params: {
      servers: 3,
      healthIntervalSec: 10,
      preStopSec: 0,
      stopGraceSec: 0,
      drainSec: 0,
      requestSec: 4,
      graceful: false,
    },
  },
  {
    id: 'long-request',
    label: '긴 요청 + 짧은 드레이닝',
    params: {
      servers: 3,
      healthIntervalSec: 5,
      preStopSec: 0,
      stopGraceSec: 30,
      drainSec: 5,
      requestSec: 20,
      graceful: true,
    },
  },
];

export function simulate(p: Params): Timeline {
  const termAt = DEPLOY_AT + p.preStopSec;
  const noticeAt = DEPLOY_AT + UNHEALTHY_THRESHOLD * p.healthIntervalSec;
  const exitAt = p.graceful ? termAt + p.stopGraceSec : termAt;
  const drainEnd = noticeAt + p.drainSec;
  const cutAt = p.graceful ? Math.min(exitAt, drainEnd) : exitAt;
  // 드레이닝이 먼저 끝나 끊는 경우와 서버가 먼저 내려가 끊는 경우를 구분해요
  const cutByDrain = p.graceful && drainEnd < exitAt;
  const newReadyAt = DEPLOY_AT + NEW_SERVER_READY_AFTER;

  const lanes: Lane[] = [];
  for (let i = 0; i < p.servers; i++) {
    lanes.push({
      label: i === 0 ? '서버 1 · 교체 대상' : `서버 ${i + 1}`,
      version: 'old',
      replaced: i === 0,
    });
  }
  const NEW = lanes.length;
  lanes.push({ label: '새 서버', version: 'new', replaced: false });

  const shots: Shot[] = [];
  const counts: Record<Status, number> = { 200: 0, 502: 0, 503: 0 };
  const total = Math.round(HORIZON / ARRIVAL_STEP);
  let rr = 0;

  for (let n = 0; n < total; n++) {
    const at = n * ARRIVAL_STEP;

    // 로드밸런서가 지금 보내도 되는 서버 목록
    const routable: number[] = [];
    for (let i = 0; i < p.servers; i++) {
      if (i !== 0 || at < noticeAt) routable.push(i);
    }
    if (at >= newReadyAt) routable.push(NEW);

    const lane = routable.length > 0 ? routable[rr % routable.length] : 0;
    rr += 1;

    let status: Status = 200;
    let reason = '정상 응답';

    if (lane === 0) {
      if (at >= exitAt) {
        status = 502;
        reason = '이미 내려간 서버로 연결이 실패했어요';
      } else if (at >= termAt) {
        status = 503;
        reason = '종료 중인 서버가 새 요청을 거절했어요';
      } else if (at + p.requestSec > cutAt) {
        status = 502;
        reason = cutByDrain
          ? '드레이닝 시간이 끝나 처리 중이던 요청을 끊었어요'
          : '서버가 내려가며 처리 중이던 요청이 끊겼어요';
      }
    }

    counts[status] += 1;
    shots.push({ id: n, at, lane, status, reason });
  }

  return { lanes, shots, counts, termAt, noticeAt, exitAt, cutAt };
}
