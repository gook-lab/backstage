export type EndpointState = 'healthy' | 'slow' | 'failing' | 'down';
export type Mode = 'sync' | 'queue' | 'isolated' | 'auto-disable';
export type Tone = 'success' | 'warning' | 'error';
export type Customer = 'A' | 'B';

export interface Config {
  /** 고객 A 의 엔드포인트 상태. 고객 B 는 항상 정상이에요 */
  readonly endpoint: EndpointState;
  readonly mode: Mode;
  /** 고객 한 명당 이벤트 수 */
  readonly events: number;
}

export interface LogLine {
  readonly t: number;
  readonly customer: Customer;
  readonly text: string;
}

export interface Snapshot {
  readonly t: number;
  /** 대기 중: 아직 보내지 않았거나 재시도 시각을 기다리는 이벤트 */
  readonly waiting: number;
  /** 전송 중: 워커가 붙잡고 있는 시도 */
  readonly inflight: number;
  readonly delivered: number;
  /** 한도를 다 쓰고 포기한 이벤트 */
  readonly gaveUp: number;
  /** 엔드포인트를 멈춰서 보류한 이벤트 */
  readonly held: number;
}

export interface Result {
  readonly log: readonly LogLine[];
  readonly snapshots: readonly Snapshot[];
  readonly endTick: number;
  readonly attempts: number;
  readonly delivered: number;
  readonly gaveUp: number;
  readonly held: number;
  /** 고객 B 이벤트가 생성부터 전달까지 걸린 가장 긴 틱 수. 1이면 바로 나간 것이에요 */
  readonly otherDelay: number;
  readonly disabled: boolean;
}

/** 워커 슬롯 수. 모든 고객의 발송이 이 슬롯을 나눠 써요 */
export const WORKERS = 2;
/** 응답을 기다리는 최대 틱. 짧게 둬요 */
export const TIMEOUT_TICKS = 3;
/** 느린 엔드포인트가 응답하는 데 걸리는 틱. 타임아웃보다 길어요 */
export const SLOW_TICKS = 5;
/** 잠깐 다운 상태가 풀리는 틱 */
export const DOWN_UNTIL = 12;
/** 큐 모드의 최대 시도 횟수(첫 시도 포함) */
export const MAX_ATTEMPTS = 6;
/** 재시도 대기의 상한 틱 */
export const BACKOFF_CAP = 16;
/** 연속 실패가 이 횟수에 닿으면 엔드포인트를 멈춰요 */
export const DISABLE_AFTER = 3;

const MAX_TICK = 200;
const SEED = 7;

export const ENDPOINT_LABEL: Record<EndpointState, string> = {
  healthy: '정상 응답',
  slow: '느림 · 응답에 5틱 걸려요',
  failing: '500 반복',
  down: '잠깐 다운 · 12틱까지 연결 실패',
};

export const MODE_LABEL: Record<Mode, string> = {
  sync: '동기 발송 · 요청 안에서 한 번만',
  queue: '큐 + 백오프',
  isolated: '큐 + 백오프 + 엔드포인트별 격리',
  'auto-disable': '자동 비활성화 · 격리 + 연속 실패 3번이면 멈춤',
};

export const DEFAULT_CONFIG: Config = { endpoint: 'healthy', mode: 'queue', events: 6 };

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

/** 실패 뒤 다음 시도까지 기다리는 틱. 2^시도 (상한 16) 안에서 무작위로 더 기다려요 (full jitter) */
export function backoffWait(attempt: number, rng: () => number): number {
  const ceiling = Math.min(BACKOFF_CAP, 2 ** attempt);
  return 1 + Math.floor(rng() * ceiling);
}

interface Attempt {
  readonly ok: boolean;
  readonly duration: number;
  readonly reason: string;
}

/** 엔드포인트 상태에 따라 한 번의 시도 결과를 정해요 */
export function attemptOf(state: EndpointState, t: number): Attempt {
  switch (state) {
    case 'healthy':
      return { ok: true, duration: 1, reason: '2xx' };
    case 'slow':
      return { ok: false, duration: TIMEOUT_TICKS, reason: `${TIMEOUT_TICKS}틱 안에 응답이 없어 시간 초과` };
    case 'failing':
      return { ok: false, duration: 1, reason: '500 응답' };
    case 'down':
      return t < DOWN_UNTIL
        ? { ok: false, duration: 1, reason: '연결 실패' }
        : { ok: true, duration: 1, reason: '2xx' };
  }
}

type Status = 'pending' | 'waiting' | 'inflight' | 'delivered' | 'failed' | 'held';

interface Ev {
  readonly id: string;
  readonly customer: Customer;
  readonly createdAt: number;
  status: Status;
  attempts: number;
  readyAt: number;
  finishAt: number;
  ok: boolean;
  reason: string;
  deliveredAt: number;
}

const TERMINAL: readonly Status[] = ['delivered', 'failed', 'held'];

/** 고객 A · B 의 이벤트를 틱마다 하나씩 만들어 발송 설정에 따라 흘려 보내요 */
export function simulate(config: Config): Result {
  const rng = mulberry32(SEED);
  const isSync = config.mode === 'sync';
  const isolated = config.mode === 'isolated' || config.mode === 'auto-disable';
  const autoDisable = config.mode === 'auto-disable';
  const maxAttempts = isSync ? 1 : MAX_ATTEMPTS;

  const events: Ev[] = [];
  for (let i = 0; i < config.events; i++) {
    for (const customer of ['A', 'B'] as const) {
      events.push({
        id: `${customer}${i + 1}`,
        customer,
        createdAt: i,
        status: 'pending',
        attempts: 0,
        readyAt: i,
        finishAt: 0,
        ok: false,
        reason: '',
        deliveredAt: -1,
      });
    }
  }
  const lastCreate = config.events - 1;

  const log: LogLine[] = [];
  const snapshots: Snapshot[] = [];
  let consecutive = 0;
  let disabled = false;
  let endTick = MAX_TICK;

  const holdWaiting = (t: number) => {
    for (const e of events) {
      if (e.customer === 'A' && e.status === 'waiting') {
        e.status = 'held';
        log.push({ t, customer: 'A', text: `${e.id} 보류 · 엔드포인트를 멈춰 보내지 않아요` });
      }
    }
  };

  const finish = (e: Ev, t: number) => {
    if (e.ok) {
      e.status = 'delivered';
      e.deliveredAt = t;
      if (e.customer === 'A') consecutive = 0;
      log.push({ t, customer: e.customer, text: `${e.id} ${e.attempts}번째 시도 성공 (2xx)` });
      return;
    }
    if (e.customer === 'A') consecutive += 1;
    if (e.attempts >= maxAttempts) {
      e.status = 'failed';
      const tail = isSync ? '재시도하지 않아 실패로 남아요' : `${MAX_ATTEMPTS}번을 다 써서 포기해요`;
      log.push({ t, customer: e.customer, text: `${e.id} ${e.attempts}번째 시도 실패 (${e.reason}) · ${tail}` });
      return;
    }
    if (autoDisable && e.customer === 'A' && disabled) {
      e.status = 'held';
      log.push({ t, customer: e.customer, text: `${e.id} 보류 · 엔드포인트를 멈춰 보내지 않아요` });
      return;
    }
    e.status = 'waiting';
    e.readyAt = t + backoffWait(e.attempts, rng);
    log.push({
      t,
      customer: e.customer,
      text: `${e.id} ${e.attempts}번째 시도 실패 (${e.reason}) · 틱 ${e.readyAt} 에 다시 보내요`,
    });
    if (autoDisable && e.customer === 'A' && !disabled && consecutive >= DISABLE_AFTER) {
      disabled = true;
      log.push({ t, customer: 'A', text: `연속 실패 ${DISABLE_AFTER}번 · 엔드포인트 A 를 멈추고 고객에게 알려요` });
      holdWaiting(t);
    }
  };

  for (let t = 0; t <= MAX_TICK; t++) {
    // 1. 끝난 시도 반영
    for (const e of events) {
      if (e.status === 'inflight' && e.finishAt === t) finish(e, t);
    }

    // 2. 이번 틱에 생성되는 이벤트
    for (const e of events) {
      if (e.status !== 'pending' || e.createdAt !== t) continue;
      if (autoDisable && disabled && e.customer === 'A') {
        e.status = 'held';
        log.push({ t, customer: 'A', text: `${e.id} 보류 · 엔드포인트를 멈춰 보내지 않아요` });
      } else {
        e.status = 'waiting';
        log.push({ t, customer: e.customer, text: `${e.id} 이벤트 생성` });
      }
    }

    // 3. 빈 워커 슬롯에 보낼 이벤트 배정
    for (;;) {
      const busy = events.filter((e) => e.status === 'inflight').length;
      if (busy >= WORKERS) break;
      const ready = events
        .filter((e) => e.status === 'waiting' && e.readyAt <= t)
        .filter((e) => !isolated || !events.some((o) => o.status === 'inflight' && o.customer === e.customer))
        .sort((a, b) => a.readyAt - b.readyAt || events.indexOf(a) - events.indexOf(b));
      if (ready.length === 0) break;
      const e = ready[0];
      const endpoint = e.customer === 'A' ? config.endpoint : 'healthy';
      const r = attemptOf(endpoint, t);
      e.attempts += 1;
      e.status = 'inflight';
      e.ok = r.ok;
      e.reason = r.reason;
      e.finishAt = t + r.duration;
      log.push({ t, customer: e.customer, text: `${e.id} ${e.attempts}번째 시도 시작` });
    }

    snapshots.push({
      t,
      waiting: events.filter((e) => e.status === 'waiting').length,
      inflight: events.filter((e) => e.status === 'inflight').length,
      delivered: events.filter((e) => e.status === 'delivered').length,
      gaveUp: events.filter((e) => e.status === 'failed').length,
      held: events.filter((e) => e.status === 'held').length,
    });

    if (t >= lastCreate && events.every((e) => TERMINAL.includes(e.status))) {
      endTick = t;
      break;
    }
  }

  const shown = snapshots.filter((s) => s.t <= endTick);
  const otherDelay = Math.max(
    0,
    ...events.filter((e) => e.customer === 'B' && e.status === 'delivered').map((e) => e.deliveredAt - e.createdAt),
  );

  return {
    log,
    snapshots: shown,
    endTick,
    attempts: events.reduce((sum, e) => sum + e.attempts, 0),
    delivered: events.filter((e) => e.status === 'delivered').length,
    gaveUp: events.filter((e) => e.status === 'failed').length,
    held: events.filter((e) => e.status === 'held').length,
    otherDelay,
    disabled,
  };
}

export function verdictOf(config: Config, result: Result): { tone: Tone; title: string } {
  if (config.mode === 'sync' && result.gaveUp > 0) {
    return { tone: 'error', title: '재시도하지 않아서 실패한 이벤트가 그대로 사라졌어요' };
  }
  if (result.disabled) {
    return { tone: 'warning', title: '연속 실패로 엔드포인트를 멈추고, 보류한 이벤트를 고객에게 알렸어요' };
  }
  if (result.otherDelay > 1) {
    return {
      tone: 'warning',
      title: `고객 B 의 발송이 ${result.otherDelay}틱 늦었어요. 고객 A 의 느린 응답이 워커를 막았어요`,
    };
  }
  if (result.gaveUp > 0) {
    return { tone: 'warning', title: '재시도 한도를 다 써도 실패한 이벤트가 남았어요' };
  }
  return { tone: 'success', title: '모든 이벤트가 제때 전달됐고, 다른 고객 발송도 밀리지 않았어요' };
}
