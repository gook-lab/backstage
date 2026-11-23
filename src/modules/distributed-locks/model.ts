/**
 * 서버 여러 대가 같은 예약 작업을 집는 상황을 틱 단위로 돌리는 순수 모델.
 * 틱 하나는 시간 단위 한 칸이에요. 실제 밀리초와는 관계가 없어요.
 */

export type Strategy = 'none' | 'processMutex' | 'redisNaive' | 'redisLock' | 'redisFencing' | 'dbUnique';

export type ScenarioId = 'simultaneous' | 'pauseExpire' | 'releaseOther';

export interface WorkerPlan {
  id: string;
  /** 같은 서버에 뜬 작업끼리 프로세스 뮤텍스를 공유해요 */
  server: 'A' | 'B';
  /** 실행을 시도하는 틱 */
  start: number;
  /** 본문을 끝내는 데 필요한 활동 틱 수 */
  work: number;
  /** 락 만료까지의 틱 수 (Redis 계열만 써요) */
  ttl: number;
  /** [from, to) 구간 동안 프로세스가 멈춰요. GC 정지나 네트워크 단절을 가정해요 */
  pause?: { from: number; to: number };
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  hint: string;
  workers: readonly WorkerPlan[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'simultaneous',
    label: '두 서버 동시 실행',
    hint: '서버 A와 B에서 같은 cron이 거의 같은 시각에 떠요.',
    workers: [
      { id: 'A1', server: 'A', start: 0, work: 3, ttl: 5 },
      { id: 'B1', server: 'B', start: 1, work: 3, ttl: 5 },
    ],
  },
  {
    id: 'pauseExpire',
    label: '락 보유자 일시 정지 후 만료',
    hint: 'A1이 작업 중에 멈췄다가 깨어나요. 그사이 락은 만료돼요.',
    workers: [
      { id: 'A1', server: 'A', start: 0, work: 4, ttl: 3, pause: { from: 1, to: 6 } },
      { id: 'B1', server: 'B', start: 4, work: 3, ttl: 5 },
    ],
  },
  {
    id: 'releaseOther',
    label: '락 해제 시 남의 락 삭제',
    hint: 'A1의 작업이 락 유효 시간보다 길어요. A1이 끝날 때 B1의 락이 잡혀 있어요.',
    workers: [
      { id: 'A1', server: 'A', start: 0, work: 3, ttl: 2 },
      { id: 'B1', server: 'B', start: 2, work: 3, ttl: 4 },
      { id: 'A2', server: 'A', start: 4, work: 2, ttl: 4 },
    ],
  },
];

export const STRATEGIES: readonly { id: Strategy; label: string; hint: string }[] = [
  { id: 'none', label: '락 없음', hint: '아무것도 막지 않아요. 각 서버가 그냥 실행해요.' },
  { id: 'processMutex', label: '프로세스 뮤텍스', hint: '같은 프로세스 안에서만 막아요. 서버마다 따로 잠가요.' },
  {
    id: 'redisNaive',
    label: 'Redis 락 · 해제를 DEL로',
    hint: 'SET NX PX로 잡고, 끝나면 키를 무조건 지워요. 흔히 하는 실수예요.',
  },
  {
    id: 'redisLock',
    label: 'Redis 락 · 값 비교 해제',
    hint: 'SET NX PX로 잡고, 내 값일 때만 지워요. 펜싱 토큰은 없어요.',
  },
  {
    id: 'redisFencing',
    label: 'Redis 락 + 펜싱 토큰',
    hint: '락에 증가하는 번호를 붙이고, 저장소가 옛 번호의 쓰기를 거절해요.',
  },
  {
    id: 'dbUnique',
    label: 'DB 유일 제약 멱등',
    hint: '락 없이, 정산 키에 유일 제약을 걸어 한 건만 저장되게 해요.',
  },
];

export type EventKind = 'start' | 'lock' | 'lockFail' | 'pause' | 'applied' | 'rejected' | 'release' | 'warn' | 'skip';

export interface TimelineEvent {
  tick: number;
  workerId: string;
  kind: EventKind;
  text: string;
}

export type CellState = 'idle' | 'run' | 'pause' | 'applied' | 'rejected' | 'skipped' | 'done';

export interface Frame {
  tick: number;
  cells: Record<string, CellState>;
  /** 락 설명 문장. 칸에 마우스를 올렸을 때 보여요 */
  lock: string;
  /** 지금 유효한 락 보유자. 없으면 null */
  holder: string | null;
  /** 만료됐지만 키가 남아 있는 보유자. 없으면 null */
  expired: string | null;
}

export interface SimResult {
  frames: Frame[];
  events: TimelineEvent[];
  /** 본문을 실제로 실행한 횟수 */
  executions: number;
  /** 저장소에 반영된 쓰기 수 */
  applied: number;
  /** 저장소가 거절한 쓰기 수 */
  rejected: number;
  workerIds: string[];
}

export const MAX_TICK = 11;

interface Lock {
  holder: string;
  token: number;
  expiresAt: number;
}

type Phase = 'waiting' | 'running' | 'finished' | 'skipped';

interface WorkerState {
  plan: WorkerPlan;
  phase: Phase;
  progress: number;
  token: number;
}

export function simulate(strategy: Strategy, scenario: Scenario): SimResult {
  const workers: WorkerState[] = scenario.workers.map((plan) => ({
    plan,
    phase: 'waiting',
    progress: 0,
    token: 0,
  }));
  const byId = new Map(workers.map((w) => [w.plan.id, w]));
  const usesRedis = strategy === 'redisNaive' || strategy === 'redisLock' || strategy === 'redisFencing';

  const frames: Frame[] = [];
  const events: TimelineEvent[] = [];
  // 클로저 안에서 바뀌므로 좁히기(narrowing)를 막으려고 초기값에 타입을 단언해요
  let lock = null as Lock | null;
  let tokenSeq = 0;
  let maxToken = 0;
  let keyTaken = false;
  let executions = 0;
  let applied = 0;
  let rejected = 0;

  const log = (tick: number, workerId: string, kind: EventKind, text: string) =>
    events.push({ tick, workerId, kind, text });

  const lockSummary = (t: number): string => {
    if (strategy === 'none') return '사용 안 함';
    if (strategy === 'processMutex') return '서버별 뮤텍스';
    if (strategy === 'dbUnique') return '사용 안 함 (유일 제약)';
    if (!lock) return '없음';
    if (lock.expiresAt <= t) return `만료됨 (${lock.holder} 기록 남음)`;
    return `${lock.holder} · 토큰 ${lock.token} · ${lock.expiresAt} 틱에 만료`;
  };

  const tryAcquire = (w: WorkerState, t: number): boolean => {
    const id = w.plan.id;
    if (strategy === 'none' || strategy === 'dbUnique') {
      log(t, id, 'start', '본문을 실행해요.');
      return true;
    }
    if (strategy === 'processMutex') {
      const busy = workers.find((o) => o !== w && o.phase === 'running' && o.plan.server === w.plan.server);
      if (busy) {
        log(t, id, 'lockFail', `서버 ${w.plan.server} 뮤텍스는 이미 ${busy.plan.id} 소유예요. 이 실행은 건너뛰어요.`);
        return false;
      }
      log(t, id, 'start', `서버 ${w.plan.server}의 뮤텍스를 잡고 본문을 실행해요.`);
      return true;
    }
    // Redis 계열: SET key value NX PX ttl
    const free = !lock || lock.expiresAt <= t;
    if (!free && lock) {
      log(t, id, 'lockFail', `락이 잡혀 있어요 (보유자 ${lock.holder}). SET NX가 실패해서 건너뛰어요.`);
      return false;
    }
    tokenSeq += 1;
    w.token = tokenSeq;
    lock = { holder: id, token: tokenSeq, expiresAt: t + w.plan.ttl };
    log(t, id, 'lock', `락을 잡았어요 (토큰 ${tokenSeq}, ${t + w.plan.ttl} 틱에 만료). 본문을 실행해요.`);
    return true;
  };

  const tryWrite = (w: WorkerState, t: number): boolean => {
    const id = w.plan.id;
    if (strategy === 'redisFencing') {
      if (w.token < maxToken) {
        log(t, id, 'rejected', `토큰 ${w.token}은 저장소가 이미 본 토큰 ${maxToken}보다 작아서 거절됐어요.`);
        return false;
      }
      maxToken = w.token;
    }
    if (strategy === 'dbUnique') {
      if (keyTaken) {
        log(t, id, 'rejected', '같은 정산 키의 행이 이미 있어서 유일 제약이 INSERT를 거절했어요.');
        return false;
      }
      keyTaken = true;
    }
    log(t, id, 'applied', '정산 결과를 저장소에 반영했어요.');
    return true;
  };

  const release = (w: WorkerState, t: number) => {
    const id = w.plan.id;
    if (!usesRedis) return;
    if (strategy === 'redisNaive') {
      if (lock && lock.holder !== id) {
        log(t, id, 'warn', `DEL이 실행됐어요. ${lock.holder} 소유 락이 지워졌어요. 남의 락을 지운 거예요.`);
      } else {
        log(t, id, 'release', '락 키를 DEL로 지웠어요.');
      }
      lock = null;
      return;
    }
    // redisLock · redisFencing: 값이 내 것일 때만 지워요
    if (lock && lock.holder === id) {
      lock = null;
      log(t, id, 'release', '내 락이라서 값을 확인하고 지웠어요.');
    } else if (lock) {
      log(t, id, 'release', `락이 ${lock.holder} 소유라서 건드리지 않았어요.`);
    }
  };

  for (let t = 0; t <= MAX_TICK; t += 1) {
    if (usesRedis && lock && lock.expiresAt === t) {
      const holder = byId.get(lock.holder);
      if (holder?.phase === 'running') {
        log(
          t,
          lock.holder,
          'warn',
          `락이 만료됐어요. ${lock.holder} 본문은 아직 실행 중이라 이 사실을 모를 수 있어요.`,
        );
      }
    }

    const cells: Record<string, CellState> = {};

    for (const w of workers) {
      const id = w.plan.id;

      if (w.phase === 'waiting') {
        cells[id] = 'idle';
        if (t === w.plan.start) {
          if (tryAcquire(w, t)) {
            w.phase = 'running';
            w.progress = 0;
            executions += 1;
            cells[id] = 'run';
          } else {
            w.phase = 'skipped';
            cells[id] = 'skipped';
          }
        }
        continue;
      }

      if (w.phase !== 'running') {
        cells[id] = 'done';
        continue;
      }

      const pause = w.plan.pause;
      if (pause && t >= pause.from && t < pause.to) {
        if (t === pause.from) log(t, id, 'pause', '프로세스가 멈췄어요. GC 정지나 네트워크 단절을 가정해요.');
        cells[id] = 'pause';
        continue;
      }

      w.progress += 1;
      cells[id] = 'run';
      if (w.progress >= w.plan.work) {
        if (tryWrite(w, t)) {
          applied += 1;
          cells[id] = 'applied';
        } else {
          rejected += 1;
          cells[id] = 'rejected';
        }
        release(w, t);
        w.phase = 'finished';
      }
    }

    const live = usesRedis && lock && lock.expiresAt > t ? lock.holder : null;
    const stale = usesRedis && lock && lock.expiresAt <= t ? lock.holder : null;
    frames.push({ tick: t, cells, lock: lockSummary(t), holder: live, expired: stale });
  }

  return {
    frames,
    events,
    executions,
    applied,
    rejected,
    workerIds: workers.map((w) => w.plan.id),
  };
}

export function scenarioById(id: ScenarioId): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`알 수 없는 사건: ${id}`);
  return s;
}
