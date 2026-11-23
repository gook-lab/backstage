export type Device = 'phone' | 'laptop';
export type Field = 'title' | 'body';
export type Order = 'laptop-first' | 'phone-first';
export type Payload = 'patch' | 'full';
export type Strategy = 'lww' | 'merge' | 'ask';

export const ORDERS: readonly Order[] = ['laptop-first', 'phone-first'];
export const ORDER_LABEL: Record<Order, string> = {
  'laptop-first': '노트북 편집이 폰 대기열보다 먼저 도착',
  'phone-first': '폰 대기열이 먼저 도착',
};

export const PAYLOADS: readonly Payload[] = ['patch', 'full'];
export const PAYLOAD_LABEL: Record<Payload, string> = {
  patch: '바뀐 필드만 보내기',
  full: '문서 전체 보내기',
};

export const STRATEGIES: readonly Strategy[] = ['lww', 'merge', 'ask'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  lww: '마지막 쓰기 우선',
  merge: '필드 단위 병합',
  ask: '사용자 선택 (보류)',
};
export const STRATEGY_HINT: Record<Strategy, string> = {
  lww: '도착한 쓰기가 항목을 그대로 덮어써요. 기준 버전을 보지 않아서 모든 응답이 200이에요.',
  merge: '필드마다 기준 버전과 실제 변경을 봐요. 손대지 않은 필드는 살리고, 같은 필드 충돌은 나중 쓰기가 덮어요.',
  ask: '필드마다 기준 버전과 실제 변경을 봐요. 같은 필드 충돌은 저장하지 않고 409로 보류해요.',
};

export const FIELDS: readonly Field[] = ['title', 'body'];
export const FIELD_LABEL: Record<Field, string> = { title: '제목', body: '본문' };
export const START: Record<Field, string> = { title: '장보기', body: '우유' };

export interface Params {
  readonly order: Order;
  readonly payload: Payload;
  readonly strategy: Strategy;
}

interface Cell {
  readonly value: string;
  readonly rev: number;
  readonly writer: Device | 'server';
}
type Doc = Record<Field, Cell>;

interface Change {
  readonly field: Field;
  readonly value: string;
  /** 기기가 편집을 시작할 때 본 버전과 값 (모든 편집은 서버 시작 상태를 보고 시작해요) */
  readonly baseRev: number;
  readonly baseValue: string;
}

interface Write {
  readonly id: 'P1' | 'P2' | 'L';
  readonly device: Device;
  readonly edit: string;
  readonly local: Record<Field, string>;
  readonly touched: readonly Field[];
}

/** 폰은 오프라인에서 두 번 고쳐 대기열에 두 건을 쌓아요. 노트북은 온라인에서 본문만 고쳐요. */
const WRITES: Record<Write['id'], Write> = {
  P1: {
    id: 'P1',
    device: 'phone',
    edit: '제목을 주말 장보기로 고침',
    local: { title: '주말 장보기', body: START.body },
    touched: ['title'],
  },
  P2: {
    id: 'P2',
    device: 'phone',
    edit: '본문에 계란 추가',
    local: { title: '주말 장보기', body: '우유, 계란' },
    touched: ['body'],
  },
  L: {
    id: 'L',
    device: 'laptop',
    edit: '본문에 두부 추가',
    local: { title: START.title, body: '우유, 두부' },
    touched: ['body'],
  },
};

const ARRIVAL: Record<Order, readonly Write['id'][]> = {
  'laptop-first': ['L', 'P1', 'P2'],
  'phone-first': ['P1', 'P2', 'L'],
};

export type Note = 'same' | 'saved' | 'kept' | 'overwrote' | 'overwrote-changed' | 'pending';

export const NOTE_LABEL: Record<Note, string> = {
  same: '이미 같은 값',
  saved: '저장',
  kept: '손대지 않은 값 유지',
  overwrote: '옛 값으로 덮어씀',
  'overwrote-changed': '나중 쓰기로 덮어씀',
  pending: '보류 (충돌)',
};

export interface WriteResult {
  readonly id: Write['id'];
  readonly device: Device;
  readonly edit: string;
  readonly sent: readonly Field[];
  readonly status: 200 | 409;
  readonly notes: readonly Note[];
}

export interface LostEdit {
  readonly device: Device;
  readonly field: Field;
  readonly value: string;
}

export interface PendingEdit {
  readonly device: Device;
  readonly field: Field;
  readonly value: string;
}

export interface Result {
  readonly writes: readonly WriteResult[];
  readonly final: Record<Field, string>;
  readonly lost: readonly LostEdit[];
  readonly pending: readonly PendingEdit[];
  /** 폰 화면: 보류된 값은 폰이 가진 값으로 보여요 */
  readonly phoneView: Record<Field, string>;
  /** 노트북 화면: 서버를 다시 받은 뒤의 값이에요 */
  readonly laptopView: Record<Field, string>;
}

const startDoc = (): Doc => ({
  title: { value: START.title, rev: 1, writer: 'server' },
  body: { value: START.body, rev: 1, writer: 'server' },
});

function changesOf(write: Write, payload: Payload): Change[] {
  const fields = payload === 'full' ? FIELDS : write.touched;
  return fields.map((field) => ({
    field,
    value: write.local[field],
    baseRev: 1,
    baseValue: START[field],
  }));
}

function applyChange(
  doc: Doc,
  ch: Change,
  device: Device,
  strategy: Strategy,
): { note: Note; lost: LostEdit | null; pending: PendingEdit | null } {
  const cur = doc[ch.field];
  if (ch.value === cur.value) return { note: 'same', lost: null, pending: null };

  if (cur.rev === ch.baseRev) {
    doc[ch.field] = { value: ch.value, rev: cur.rev + 1, writer: device };
    return { note: 'saved', lost: null, pending: null };
  }

  // 서버 값이 기준 이후 바뀌었어요
  const unchangedByDevice = ch.value === ch.baseValue;
  if (unchangedByDevice && strategy !== 'lww') {
    return { note: 'kept', lost: null, pending: null };
  }

  if (!unchangedByDevice && strategy === 'ask') {
    return {
      note: 'pending',
      lost: null,
      pending: { device, field: ch.field, value: ch.value },
    };
  }

  const lost: LostEdit | null =
    cur.writer !== 'server' && cur.writer !== device ? { device: cur.writer, field: ch.field, value: cur.value } : null;
  doc[ch.field] = { value: ch.value, rev: cur.rev + 1, writer: device };
  return { note: unchangedByDevice ? 'overwrote' : 'overwrote-changed', lost, pending: null };
}

export function simulate(params: Params): Result {
  const doc = startDoc();
  const lost: LostEdit[] = [];
  const pending: PendingEdit[] = [];
  const writes: WriteResult[] = [];

  for (const id of ARRIVAL[params.order]) {
    const write = WRITES[id];
    const sent: Field[] = [];
    const notes: Note[] = [];
    let status: 200 | 409 = 200;

    for (const ch of changesOf(write, params.payload)) {
      sent.push(ch.field);
      const r = applyChange(doc, ch, write.device, params.strategy);
      notes.push(r.note);
      if (r.lost) lost.push(r.lost);
      if (r.pending) {
        pending.push(r.pending);
        status = 409;
      }
    }

    writes.push({ id, device: write.device, edit: write.edit, sent, status, notes });
  }

  const final = { title: doc.title.value, body: doc.body.value };
  const phoneView = { ...final };
  for (const p of pending) phoneView[p.field] = p.value;

  return { writes, final, lost, pending, phoneView, laptopView: { ...final } };
}
