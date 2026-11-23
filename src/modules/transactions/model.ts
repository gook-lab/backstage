export type TxId = 'A' | 'B';
export type RowId = 'stock' | 'order';

export const TX_ORDER: readonly TxId[] = ['A', 'B'];
export const ROW_IDS: readonly RowId[] = ['stock', 'order'];
export const ROW_LABEL: Record<RowId, string> = { stock: '재고', order: '주문 수' };

export interface Row {
  readonly value: number;
  readonly version: number;
}

export type Step =
  | { readonly op: 'read'; readonly row: RowId }
  | { readonly op: 'lock'; readonly row: RowId }
  | { readonly op: 'write'; readonly row: RowId; readonly delta: number }
  | { readonly op: 'write-if-version'; readonly row: RowId; readonly delta: number }
  | { readonly op: 'decrement-if-positive'; readonly row: RowId }
  | { readonly op: 'commit' };

type LockingStep = Exclude<Step, { op: 'read' } | { op: 'commit' }>;

export type TxStatus = 'running' | 'waiting' | 'committed' | 'aborted';
export type Outcome = 'committed' | 'deadlock' | 'conflict' | 'rejected';
export type LogKind = 'info' | 'wait' | 'commit' | 'deadlock' | 'conflict' | 'rejected';

export interface Tx {
  readonly id: TxId;
  readonly script: readonly Step[];
  readonly pc: number;
  readonly status: TxStatus;
  readonly outcome?: Outcome;
  readonly snapshot: Partial<Record<RowId, Row>>;
  readonly pending: Partial<Record<RowId, Row>>;
  readonly waitingFor?: RowId;
}

export interface LogEntry {
  readonly tx: TxId;
  readonly kind: LogKind;
  readonly text: string;
}

export interface RunState {
  readonly rows: Readonly<Record<RowId, Row>>;
  readonly locks: Readonly<Partial<Record<RowId, TxId>>>;
  readonly txs: Readonly<Record<TxId, Tx>>;
  readonly log: readonly LogEntry[];
}

export interface WaitEdge {
  readonly from: TxId;
  readonly to: TxId;
  readonly row: RowId;
}

export type PresetId = 'lost-update' | 'for-update' | 'optimistic' | 'atomic-update' | 'deadlock';

export interface Preset {
  readonly id: PresetId;
  readonly label: string;
  readonly summary: string;
  readonly rows: Readonly<Record<RowId, Row>>;
  readonly scripts: Readonly<Record<TxId, readonly Step[]>>;
  /** 이 순서로 누르면 프리셋의 결과가 그대로 나온다 */
  readonly schedule: readonly TxId[];
}

const seeded = (stock: number): Record<RowId, Row> => ({
  stock: { value: stock, version: 0 },
  order: { value: 0, version: 0 },
});

const readThenWrite: readonly Step[] = [
  { op: 'read', row: 'stock' },
  { op: 'write', row: 'stock', delta: -1 },
  { op: 'commit' },
];

export const PRESETS: readonly Preset[] = [
  {
    id: 'lost-update',
    label: '락 없이 읽고 쓰기',
    summary: '두 사람이 재고 2 를 각각 읽고 1 씩 뺐어요. 둘 다 성공했지만 재고는 1 이에요. 한 번의 구매가 사라졌어요.',
    rows: seeded(2),
    scripts: { A: readThenWrite, B: readThenWrite },
    schedule: ['A', 'B', 'A', 'B', 'A', 'B', 'B'],
  },
  {
    id: 'for-update',
    label: 'FOR UPDATE · B 대기',
    summary: 'SELECT 할 때 락을 먼저 잡아요. B 는 A 가 끝날 때까지 기다렸다가 최신 값을 읽어요.',
    rows: seeded(2),
    scripts: {
      A: [{ op: 'lock', row: 'stock' }, { op: 'write', row: 'stock', delta: -1 }, { op: 'commit' }],
      B: [{ op: 'lock', row: 'stock' }, { op: 'write', row: 'stock', delta: -1 }, { op: 'commit' }],
    },
    schedule: ['A', 'B', 'A', 'A', 'B', 'B', 'B'],
  },
  {
    id: 'optimistic',
    label: '버전 컬럼 · B 충돌',
    summary: '락 없이 읽고, 쓸 때 읽은 version 이 그대로인지 확인해요. 바뀌었으면 0 행이 갱신돼 B 는 충돌을 받아요.',
    rows: seeded(2),
    scripts: {
      A: [{ op: 'read', row: 'stock' }, { op: 'write-if-version', row: 'stock', delta: -1 }, { op: 'commit' }],
      B: [{ op: 'read', row: 'stock' }, { op: 'write-if-version', row: 'stock', delta: -1 }, { op: 'commit' }],
    },
    schedule: ['A', 'B', 'A', 'B', 'A', 'B'],
  },
  {
    id: 'atomic-update',
    label: '원자적 UPDATE · 재고 소진',
    summary: 'UPDATE 한 문장으로 읽기와 쓰기를 같이 해요. 재고가 1 이라서 B 는 0 행이 되어 거절돼요.',
    rows: seeded(1),
    scripts: {
      A: [{ op: 'decrement-if-positive', row: 'stock' }, { op: 'commit' }],
      B: [{ op: 'decrement-if-positive', row: 'stock' }, { op: 'commit' }],
    },
    schedule: ['A', 'B', 'A', 'B'],
  },
  {
    id: 'deadlock',
    label: '두 행을 반대 순서로 · 데드락',
    summary: 'A 는 order 다음 stock, B 는 stock 다음 order 로 잠가요. 서로 상대가 쥔 락을 기다리면 순환이 생겨요.',
    rows: seeded(2),
    scripts: {
      A: [
        { op: 'lock', row: 'order' },
        { op: 'lock', row: 'stock' },
        { op: 'write', row: 'order', delta: 1 },
        { op: 'write', row: 'stock', delta: -1 },
        { op: 'commit' },
      ],
      B: [
        { op: 'lock', row: 'stock' },
        { op: 'lock', row: 'order' },
        { op: 'write', row: 'stock', delta: -1 },
        { op: 'write', row: 'order', delta: 1 },
        { op: 'commit' },
      ],
    },
    schedule: ['A', 'B', 'A', 'B', 'A', 'A', 'A', 'A'],
  },
];

export function getPreset(id: PresetId): Preset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`unknown preset: ${id}`);
  return preset;
}

function newTx(id: TxId, script: readonly Step[]): Tx {
  return { id, script, pc: 0, status: 'running', snapshot: {}, pending: {} };
}

export function createRun(preset: Preset): RunState {
  return {
    rows: preset.rows,
    locks: {},
    txs: { A: newTx('A', preset.scripts.A), B: newTx('B', preset.scripts.B) },
    log: [],
  };
}

export function isFinished(tx: Tx): boolean {
  return tx.status === 'committed' || tx.status === 'aborted';
}

export function isDone(state: RunState): boolean {
  return TX_ORDER.every((id) => isFinished(state.txs[id]));
}

export function waitEdges(state: RunState): WaitEdge[] {
  return TX_ORDER.flatMap((from): WaitEdge[] => {
    const tx = state.txs[from];
    if (tx.status !== 'waiting' || tx.waitingFor === undefined) return [];
    const to = state.locks[tx.waitingFor];
    return to === undefined ? [] : [{ from, to, row: tx.waitingFor }];
  });
}

export function describeStep(step: Step): string {
  switch (step.op) {
    case 'read':
      return `SELECT ${step.row}`;
    case 'lock':
      return `SELECT ${step.row} FOR UPDATE`;
    case 'write':
      return `UPDATE ${step.row} = 읽은 값 ${signed(step.delta)}`;
    case 'write-if-version':
      return `UPDATE ${step.row} = 읽은 값 ${signed(step.delta)} WHERE version = 읽은 version`;
    case 'decrement-if-positive':
      return `UPDATE ${step.row} SET value = value - 1 WHERE value > 0`;
    case 'commit':
      return 'COMMIT';
  }
}

function signed(delta: number): string {
  return delta >= 0 ? `+ ${delta}` : `- ${-delta}`;
}

function show(row: Row): string {
  return `${row.value} (v${row.version})`;
}

function setTx(state: RunState, id: TxId, patch: Partial<Tx>): RunState {
  return { ...state, txs: { ...state.txs, [id]: { ...state.txs[id], ...patch } } };
}

function push(state: RunState, tx: TxId, kind: LogKind, text: string): RunState {
  return { ...state, log: [...state.log, { tx, kind, text }] };
}

function releaseAll(locks: RunState['locks'], id: TxId): RunState['locks'] {
  return Object.fromEntries(Object.entries(locks).filter(([, holder]) => holder !== id)) as RunState['locks'];
}

function acquire(state: RunState, id: TxId, row: RowId): RunState {
  const locked = { ...state, locks: { ...state.locks, [row]: id } };
  return setTx(locked, id, { status: 'running', waitingFor: undefined });
}

function stage(state: RunState, id: TxId, row: RowId, pending: Row, text: string): RunState {
  const tx = state.txs[id];
  const next = setTx(state, id, { pc: tx.pc + 1, pending: { ...tx.pending, [row]: pending } });
  return push(next, id, 'info', text);
}

function abort(state: RunState, id: TxId, outcome: Outcome, kind: LogKind, text: string): RunState {
  const released = { ...state, locks: releaseAll(state.locks, id) };
  const next = setTx(released, id, { status: 'aborted', outcome, pending: {}, waitingFor: undefined });
  return push(next, id, kind, text);
}

function commit(state: RunState, id: TxId): RunState {
  const tx = state.txs[id];
  const rows = { ...state.rows, ...tx.pending };
  const applied = { ...state, rows, locks: releaseAll(state.locks, id) };
  const next = setTx(applied, id, { pc: tx.pc + 1, status: 'committed', outcome: 'committed', pending: {} });
  return push(next, id, 'commit', `${id} 가 COMMIT 했어요. 쓴 값이 모두에게 보이고, 잡고 있던 락이 풀렸어요.`);
}

function blockerOf(state: RunState, id: TxId): TxId | undefined {
  const tx = state.txs[id];
  if (tx.status !== 'waiting' || tx.waitingFor === undefined) return undefined;
  return state.locks[tx.waitingFor];
}

/** start 에서 출발해 대기 사슬을 따라가 start 로 돌아오면 순환 */
function findCycle(state: RunState, start: TxId): TxId[] | null {
  const path: TxId[] = [start];
  let next = blockerOf(state, start);
  while (next !== undefined && next !== start && !path.includes(next)) {
    path.push(next);
    next = blockerOf(state, next);
  }
  return next === start ? path : null;
}

function waitFor(state: RunState, id: TxId, row: RowId, holder: TxId): RunState {
  const waiting = push(
    setTx(state, id, { status: 'waiting', waitingFor: row }),
    id,
    'wait',
    `${id} 가 ${row} 락을 기다려요. ${holder} 가 잡고 있어요.`,
  );
  const cycle = findCycle(waiting, id);
  if (cycle === null) return waiting;
  const victim = cycle.reduce((a, b) => (TX_ORDER.indexOf(b) > TX_ORDER.indexOf(a) ? b : a));
  const chain = [...cycle, cycle[0]].join(' → ');
  return abort(
    waiting,
    victim,
    'deadlock',
    'deadlock',
    `데드락이에요. ${chain} 로 서로를 기다려요. 나중에 시작한 ${victim} 을 중단하고 변경을 버렸어요. 앱은 이 실패를 재시도해요.`,
  );
}

function execute(state: RunState, id: TxId, step: LockingStep): RunState {
  const tx = state.txs[id];
  const latest = state.rows[step.row];
  const base = tx.snapshot[step.row] ?? latest;
  switch (step.op) {
    case 'lock': {
      const next = setTx(state, id, { pc: tx.pc + 1, snapshot: { ...tx.snapshot, [step.row]: latest } });
      return push(next, id, 'info', `${id} 가 FOR UPDATE 로 락을 잡고 ${step.row} ${show(latest)} 을 읽었어요.`);
    }
    case 'write': {
      const pending = { value: base.value + step.delta, version: latest.version + 1 };
      return stage(
        state,
        id,
        step.row,
        pending,
        `${id} 가 읽은 ${base.value} 에 ${signed(step.delta)} 를 계산해 UPDATE 했어요. 락은 커밋까지 잡아요.`,
      );
    }
    case 'write-if-version': {
      if (latest.version !== base.version) {
        return abort(
          state,
          id,
          'conflict',
          'conflict',
          `WHERE version = ${base.version} 이 0 행을 맞혔어요. version 이 ${latest.version} 으로 바뀌었어요. ${id} 는 롤백하고 409 Conflict 를 받아요.`,
        );
      }
      const pending = { value: base.value + step.delta, version: latest.version + 1 };
      return stage(
        state,
        id,
        step.row,
        pending,
        `version ${base.version} 이 그대로라 UPDATE 가 1 행에 맞았어요. version 은 ${pending.version} 이 돼요.`,
      );
    }
    case 'decrement-if-positive': {
      if (latest.value <= 0) {
        return abort(
          state,
          id,
          'rejected',
          'rejected',
          `WHERE value > 0 을 만족하는 행이 없어요. 0 행이라 ${id} 는 롤백하고 거절당해요.`,
        );
      }
      const pending = { value: latest.value - 1, version: latest.version + 1 };
      return stage(
        state,
        id,
        step.row,
        pending,
        `최신 값 ${latest.value} 을 DB 가 직접 깎았어요. WHERE value > 0 을 만족해 1 행이 바뀌었어요.`,
      );
    }
  }
}

export function advance(state: RunState, id: TxId): RunState {
  const tx = state.txs[id];
  if (isFinished(tx)) return state;
  const step = tx.script[tx.pc];
  if (step.op === 'read') {
    const seen = state.rows[step.row];
    const next = setTx(state, id, { pc: tx.pc + 1, snapshot: { ...tx.snapshot, [step.row]: seen } });
    return push(next, id, 'info', `${id} 가 SELECT ${step.row} 로 ${show(seen)} 을 읽었어요. 락은 잡지 않아요.`);
  }
  if (step.op === 'commit') return commit(state, id);
  const holder = state.locks[step.row];
  if (holder !== undefined && holder !== id) return waitFor(state, id, step.row, holder);
  return execute(acquire(state, id, step.row), id, step);
}
