export type Lane = 'queue' | 'consumer' | 'dlq';
export type Backoff = 'none' | 'exponential';
export type Tone = 'success' | 'warning' | 'error';

export interface Config {
  readonly messages: number;
  readonly failPercent: number;
  readonly ackLossPercent: number;
  readonly maxReceives: number;
  readonly backoff: Backoff;
  readonly idempotent: boolean;
  readonly seed: number;
}

export interface SimEvent {
  readonly t: number;
  readonly lane: Lane;
  readonly text: string;
}

export interface Result {
  readonly events: readonly SimEvent[];
  readonly receives: number;
  readonly grants: number;
  readonly doubleGranted: number;
  readonly acked: number;
  readonly dead: number;
  readonly deadButGranted: number;
  readonly endTick: number;
}

/** 처리 중인 메시지를 다른 소비자에게 숨기는 시간(틱). 처리 시간보다 길어야 해요 */
export const VISIBILITY_TICKS = 3;
const BACKOFF_CAP = 8;

export const DEFAULT_CONFIG: Config = {
  messages: 10,
  failPercent: 0,
  ackLossPercent: 0,
  maxReceives: 3,
  backoff: 'none',
  idempotent: false,
  seed: 7,
};

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly config: Config;
}

const preset = (id: string, label: string, patch: Partial<Config>): Preset => ({
  id,
  label,
  config: { ...DEFAULT_CONFIG, ...patch },
});

export const PRESETS: readonly Preset[] = [
  preset('clean', '정상 처리 · 재시도 없음', {}),
  preset('retry', '처리 실패 40% · 재시도 5번 · 지수 백오프', {
    failPercent: 40,
    maxReceives: 5,
    backoff: 'exponential',
  }),
  preset('ack-lost', 'ack 유실 50% · 멱등 처리 끔', { ackLossPercent: 50, maxReceives: 5 }),
  preset('ack-lost-idem', 'ack 유실 50% · 멱등 처리 켬', {
    ackLossPercent: 50,
    maxReceives: 5,
    idempotent: true,
  }),
  preset('poison', '항상 실패하는 메시지 · 재시도 3번 → DLQ', {
    failPercent: 100,
    maxReceives: 3,
    backoff: 'exponential',
  }),
];

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

/** 실패한 메시지가 다시 보이기까지 기다리는 틱. 지수 백오프는 2^시도 (상한 8) 안에서 jitter 를 섞어요 */
export function retryWait(attempt: number, backoff: Backoff, rng: () => number): number {
  if (backoff === 'none') return VISIBILITY_TICKS;
  const base = Math.min(BACKOFF_CAP, 2 ** attempt);
  return VISIBILITY_TICKS + Math.floor(rng() * (base + 1));
}

interface Message {
  readonly id: number;
  receives: number;
  visibleAt: number;
  grants: number;
  state: 'pending' | 'done' | 'dead';
}

/** 소비자는 한 번에 메시지 하나를 처리해요. 실패는 적용 전에, ack 유실은 적용 뒤에 일어난다고 가정해요 */
export function simulate(config: Config): Result {
  const rng = mulberry32(config.seed);
  const events: SimEvent[] = [];
  const log = (t: number, lane: Lane, text: string) => events.push({ t, lane, text });
  const messages: Message[] = Array.from({ length: config.messages }, (_, i) => ({
    id: i + 1,
    receives: 0,
    visibleAt: 0,
    grants: 0,
    state: 'pending',
  }));
  const dedupe = new Set<number>();
  let t = 0;
  let receives = 0;
  let grants = 0;
  let acked = 0;
  let dead = 0;
  let deadButGranted = 0;

  for (;;) {
    const pending = messages.filter((m) => m.state === 'pending');
    if (pending.length === 0) break;

    const visible = pending.filter((m) => m.visibleAt <= t).sort((a, b) => a.visibleAt - b.visibleAt || a.id - b.id);
    if (visible.length === 0) {
      t = Math.min(...pending.map((m) => m.visibleAt));
      continue;
    }

    const m = visible[0];
    if (m.receives >= config.maxReceives) {
      m.state = 'dead';
      dead += 1;
      const granted = m.grants > 0;
      if (granted) deadButGranted += 1;
      const tail = granted ? ` 포인트는 이미 ${m.grants}번 지급됐어요.` : '';
      log(t, 'dlq', `#${m.id} 를 ${m.receives}번 받았지만 끝내지 못해 DLQ 로 옮겼어요.${tail}`);
      continue;
    }

    m.receives += 1;
    receives += 1;
    log(t, 'consumer', `#${m.id} 를 ${m.receives}번째로 받았어요.`);

    if (rng() * 100 < config.failPercent) {
      const wait = retryWait(m.receives, config.backoff, rng);
      m.visibleAt = t + 1 + wait;
      log(t, 'consumer', `처리에 실패했어요. 포인트는 지급하지 않았어요. 틱 ${m.visibleAt} 이후 다시 보여요.`);
      t += 1;
      continue;
    }

    if (config.idempotent && dedupe.has(m.id)) {
      log(t, 'consumer', `이미 처리한 #${m.id} 예요. 포인트는 건너뛰어요.`);
    } else {
      dedupe.add(m.id);
      m.grants += 1;
      grants += 1;
      log(t, 'consumer', `#${m.id} 포인트를 지급했어요. (${m.grants}번째)`);
    }

    if (rng() * 100 < config.ackLossPercent) {
      m.visibleAt = t + 1 + VISIBILITY_TICKS;
      log(t + 1, 'queue', `ack 응답이 유실됐어요. #${m.id} 는 틱 ${m.visibleAt} 이후 다시 보여요.`);
    } else {
      m.state = 'done';
      acked += 1;
      log(t + 1, 'queue', `#${m.id} ack 를 받아 큐에서 지웠어요.`);
    }
    t += 1;
  }

  return {
    events,
    receives,
    grants,
    doubleGranted: messages.filter((m) => m.grants > 1).length,
    acked,
    dead,
    deadButGranted,
    endTick: t,
  };
}

export interface Verdict {
  readonly tone: Tone;
  readonly title: string;
}

export function verdictOf(result: Result): Verdict {
  if (result.doubleGranted > 0) {
    return {
      tone: 'error',
      title: `${result.doubleGranted}건은 포인트를 두 번 이상 지급됐어요. 소비자가 같은 메시지를 또 처리했어요.`,
    };
  }
  if (result.dead > 0 && result.deadButGranted > 0) {
    return {
      tone: 'warning',
      title: `DLQ 로 간 ${result.dead}건 중 ${result.deadButGranted}건은 포인트가 이미 지급됐어요. DLQ 는 처리 실패뿐 아니라 ack 유실이 반복된 메시지도 모아요.`,
    };
  }
  if (result.dead > 0) {
    return {
      tone: 'warning',
      title: `${result.dead}건이 재시도 한도를 넘어 DLQ 로 갔어요. 원인을 보고 사람이 다시 넣어야 해요.`,
    };
  }
  return {
    tone: 'success',
    title: `${result.acked}건 모두 포인트를 한 번만 지급하고 ack 했어요.`,
  };
}
