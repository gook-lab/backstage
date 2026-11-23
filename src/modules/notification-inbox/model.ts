/** 읽음을 기록하는 방식. flag: 알림 행마다 read_at. cursor: 사용자별 읽음 커서 + 커서 밖 예외 행 */
export type ReadMode = 'flag' | 'cursor';
/** 안 읽은 개수를 세는 방식. count: 배지를 열 때마다 COUNT. counter: 칸 하나에 저장 */
export type CountMode = 'count' | 'counter';
/** 카운터 차감 규칙. checked: 영향받은 행 수가 1일 때만 -1. blind: 요청마다 무조건 -1 */
export type CounterWrite = 'checked' | 'blind';
export type Action = 'arrive' | 'read-one' | 'read-all' | 'race-read' | 'recount';

export const READ_MODES: readonly ReadMode[] = ['flag', 'cursor'];
export const READ_MODE_LABEL: Record<ReadMode, string> = {
  flag: '행마다 read_at',
  cursor: '읽음 커서 (last_read_at)',
};

export const COUNT_MODES: readonly CountMode[] = ['count', 'counter'];
export const COUNT_MODE_LABEL: Record<CountMode, string> = {
  count: '매번 COUNT',
  counter: '카운터 칸 하나',
};

export const COUNTER_WRITES: readonly CounterWrite[] = ['checked', 'blind'];
export const COUNTER_WRITE_LABEL: Record<CounterWrite, string> = {
  checked: '영향 행 수를 보고 차감',
  blind: '무조건 -1',
};

export const ACTIONS: readonly Action[] = ['arrive', 'read-one', 'read-all', 'race-read', 'recount'];
export const ACTION_LABEL: Record<Action, string> = {
  arrive: '새 알림 도착',
  'read-one': '맨 위 알림 하나 읽기',
  'read-all': '모두 읽음',
  'race-read': '두 탭이 맨 위 알림을 동시에 읽기',
  recount: '카운터 다시 세기',
};

export const INITIAL_MIN = 5;
export const INITIAL_MAX = 200;

export interface Config {
  readonly readMode: ReadMode;
  readonly countMode: CountMode;
  readonly counterWrite: CounterWrite;
  /** 처음 안 읽은 알림 수 */
  readonly initial: number;
}

/** seq 는 도착 순서 번호예요. 시뮬레이터에서는 시각 대신 이 번호로 "먼저 온 것"을 판단해요 */
export interface Notice {
  readonly seq: number;
  readonly readAt: number | null;
}

export interface LogEntry {
  readonly step: number;
  readonly action: Action;
  /** 이 동작에서 갱신(INSERT · UPDATE · DELETE)된 행 수 */
  readonly touched: number;
  readonly badge: number;
  readonly truth: number;
  readonly diff: number;
  readonly note: string;
}

export interface Run {
  readonly cfg: Config;
  readonly items: readonly Notice[];
  /** cursor 방식: seq 가 이 값 이하인 알림은 모두 읽음 */
  readonly cursor: number;
  /** cursor 방식: 커서 밖에서 따로 읽은 seq 목록 (예외 행) */
  readonly exceptions: readonly number[];
  /** counter 방식의 칸 값 */
  readonly counter: number;
  readonly nextSeq: number;
  readonly step: number;
  readonly totalTouched: number;
  readonly log: readonly LogEntry[];
}

export function createRun(cfg: Config): Run {
  const items: Notice[] = Array.from({ length: cfg.initial }, (_, i) => ({ seq: i + 1, readAt: null }));
  return {
    cfg,
    items,
    cursor: 0,
    exceptions: [],
    counter: cfg.initial,
    nextSeq: cfg.initial + 1,
    step: 0,
    totalTouched: 0,
    log: [],
  };
}

function isUnread(run: Run, item: Notice): boolean {
  if (run.cfg.readMode === 'flag') return item.readAt === null;
  return item.seq > run.cursor && !run.exceptions.includes(item.seq);
}

/** 실제 안 읽은 알림 수 (원본 행을 세어 얻은 값) */
export function trueUnread(run: Run): number {
  return run.items.reduce((n, it) => (isUnread(run, it) ? n + 1 : n), 0);
}

/** 배지에 보이는 숫자 */
export function badgeValue(run: Run): number {
  return run.cfg.countMode === 'counter' ? run.counter : trueUnread(run);
}

/** 개수를 원본에서 셀 때 훑는 행 수. flag 는 부분 인덱스 항목(안 읽은 행), cursor 는 커서 뒤 범위 */
export function countRows(run: Run): number {
  if (run.cfg.readMode === 'flag') return trueUnread(run);
  return run.items.reduce((n, it) => (it.seq > run.cursor ? n + 1 : n), 0);
}

/** 배지 한 번을 그리는 데 읽는 행 수. 카운터는 칸 하나만 읽어요 */
export function badgeRows(run: Run): number {
  return run.cfg.countMode === 'counter' ? 1 : countRows(run);
}

function newestUnread(run: Run): Notice | undefined {
  for (let i = run.items.length - 1; i >= 0; i--) {
    if (isUnread(run, run.items[i])) return run.items[i];
  }
  return undefined;
}

/** 커서 바로 다음부터 예외 행이 이어지면 커서를 옮기고 예외 행을 지워요 */
function compact(
  cursor: number,
  exceptions: readonly number[],
): { cursor: number; exceptions: number[]; advanced: number } {
  let c = cursor;
  let ex = [...exceptions];
  let advanced = 0;
  while (ex.includes(c + 1)) {
    ex = ex.filter((s) => s !== c + 1);
    c += 1;
    advanced += 1;
  }
  return { cursor: c, exceptions: ex, advanced };
}

export function apply(run: Run, action: Action): Run {
  const { cfg } = run;
  const step = run.step + 1;
  let items = [...run.items];
  let cursor = run.cursor;
  let exceptions = [...run.exceptions];
  let counter = run.counter;
  let nextSeq = run.nextSeq;
  let touched = 0;
  let note = '';

  if (action === 'arrive') {
    items.push({ seq: nextSeq, readAt: null });
    nextSeq += 1;
    touched = 1;
    note = '새 알림 한 건이 들어왔어요.';
    if (cfg.countMode === 'counter') {
      counter += 1;
      touched += 1;
    }
  } else if (action === 'read-one') {
    const target = newestUnread(run);
    if (!target) {
      note = '읽을 알림이 없어요.';
    } else {
      if (cfg.readMode === 'flag') {
        items = items.map((it) => (it.seq === target.seq ? { ...it, readAt: step } : it));
        touched = 1;
        note = `알림 ${target.seq} 의 read_at 을 채웠어요.`;
      } else {
        exceptions.push(target.seq);
        touched = 1;
        const c = compact(cursor, exceptions);
        cursor = c.cursor;
        exceptions = c.exceptions;
        if (c.advanced > 0) touched += 1 + c.advanced;
        note =
          c.advanced > 0
            ? `커서를 ${cursor} 까지 옮기고 예외 행 ${c.advanced}개를 지웠어요.`
            : `커서 밖 예외 행 하나를 넣었어요 (알림 ${target.seq}).`;
      }
      if (cfg.countMode === 'counter') {
        counter -= 1;
        touched += 1;
      }
    }
  } else if (action === 'read-all') {
    const unread = trueUnread(run);
    if (unread === 0) {
      note = '안 읽은 알림이 없어요.';
    } else if (cfg.readMode === 'flag') {
      items = items.map((it) => (it.readAt === null ? { ...it, readAt: step } : it));
      touched = unread;
      note = `안 읽은 행 ${unread}개의 read_at 을 채웠어요.`;
    } else {
      touched = 1 + run.exceptions.length;
      cursor = nextSeq - 1;
      exceptions = [];
      note = `커서를 ${cursor} 로 옮기고 예외 행 ${run.exceptions.length}개를 지웠어요.`;
    }
    if (unread > 0 && cfg.countMode === 'counter') {
      counter = 0;
      touched += 1;
    }
  } else if (action === 'race-read') {
    const target = newestUnread(run);
    if (!target) {
      note = '읽을 알림이 없어요.';
    } else {
      // 첫 요청은 행을 갱신하고, 둘째 요청은 조건에 맞는 행이 없어 0 행을 갱신해요
      if (cfg.readMode === 'flag') {
        items = items.map((it) => (it.seq === target.seq ? { ...it, readAt: step } : it));
        touched = 1;
      } else {
        exceptions.push(target.seq);
        touched = 1;
        const c = compact(cursor, exceptions);
        cursor = c.cursor;
        exceptions = c.exceptions;
        if (c.advanced > 0) touched += 1 + c.advanced;
      }
      if (cfg.countMode === 'counter') {
        if (cfg.counterWrite === 'checked') {
          counter -= 1;
          touched += 1;
          note = '첫 요청만 차감했어요. 둘째 요청은 0 행이라 차감하지 않았어요.';
        } else {
          counter -= 2;
          touched += 2;
          note = '두 요청이 모두 -1 을 해서 칸이 두 번 줄었어요.';
        }
      } else {
        note = '둘째 요청은 이미 읽은 알림이라 0 행을 갱신했어요.';
      }
    }
  } else {
    if (cfg.countMode !== 'counter') {
      note = 'COUNT 방식에는 칸이 없어서 다시 셀 값이 없어요.';
    } else {
      counter = trueUnread(run);
      touched = 1;
      note = '칸을 실제 안 읽은 수에 맞췄어요.';
    }
  }

  const next: Run = {
    cfg,
    items,
    cursor,
    exceptions,
    counter,
    nextSeq,
    step,
    totalTouched: run.totalTouched + touched,
    log: run.log,
  };
  const badge = badgeValue(next);
  const truth = trueUnread(next);
  return {
    ...next,
    log: [...run.log, { step, action, touched, badge, truth, diff: badge - truth, note }],
  };
}
