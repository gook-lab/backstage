/**
 * 실시간 공동 편집의 네 가지 방식을 한 장면에 맞춘 순수 모델.
 *
 * 단순화한 부분:
 * - 기준 문서 "회의록" 에서 두 사용자가 각자 연산을 하나씩 보내요.
 * - 연산은 한 글자 삭제와 글자 삽입만 다뤄요.
 * - 인과 순서 대기나 네트워크 지연, 재전송은 빼요. 도착 순서만 바꿔 봐요.
 * - 서버는 도착한 순서를 그대로 기록하고 다른 사용자에게 알려 준다고 가정해요.
 */

export type Method = 'overwrite' | 'raw' | 'ot' | 'crdt';
export type Combo = 'same-insert' | 'insert-delete' | 'same-delete';
export type Arrival = 'a-first' | 'b-first';
export type Who = 'A' | 'B';

export type Op = { kind: 'insert'; at: number; text: string } | { kind: 'delete'; at: number };

export const BASE = '회의록';

export const METHODS: readonly Method[] = ['overwrite', 'raw', 'ot', 'crdt'];
export const METHOD_LABEL: Record<Method, string> = {
  overwrite: '전체 덮어쓰기',
  raw: '위치 그대로 적용',
  ot: '위치 변환 (OT)',
  crdt: '글자 id (CRDT)',
};
export const METHOD_HINT: Record<Method, string> = {
  overwrite: '저장할 때 문서 전체를 보내요. 나중에 도착한 저장이 앞 저장을 통째로 덮어요.',
  raw: '연산의 위치 숫자를 그대로 적용해요. 먼저 도착한 연산이 위치를 밀어 두 번째 연산의 위치가 어긋나요.',
  ot: '서버가 정한 순서에 맞춰 나중 연산의 위치를 고쳐요. 두 화면이 같은 결과로 모여요.',
  crdt: '글자마다 고유 id 를 붙여요. 위치 숫자 대신 id 사이의 관계로 순서를 정해요.',
};

export const COMBOS: readonly Combo[] = ['same-insert', 'insert-delete', 'same-delete'];
export const COMBO_LABEL: Record<Combo, string> = {
  'same-insert': '같은 자리에 삽입',
  'insert-delete': '한쪽 삭제 · 다른 쪽 삽입',
  'same-delete': '같은 글자 동시 삭제',
};

export const ARRIVALS: readonly Arrival[] = ['a-first', 'b-first'];
export const ARRIVAL_LABEL: Record<Arrival, string> = {
  'a-first': 'A 가 먼저 도착',
  'b-first': 'B 가 먼저 도착',
};

/** 장면의 두 연산. A 와 B 가 같은 기준 문서 BASE 에서 보낸 연산이에요. */
export const SCENE: Record<Combo, { a: Op; b: Op; aText: string; bText: string }> = {
  'same-insert': {
    a: { kind: 'insert', at: 0, text: '오늘 ' },
    b: { kind: 'insert', at: 0, text: '정리: ' },
    aText: '오늘 ',
    bText: '정리: ',
  },
  'insert-delete': {
    a: { kind: 'delete', at: 1 },
    b: { kind: 'insert', at: 0, text: '정리: ' },
    aText: '의',
    bText: '정리: ',
  },
  'same-delete': {
    a: { kind: 'delete', at: 1 },
    b: { kind: 'delete', at: 1 },
    aText: '의',
    bText: '의',
  },
};

/* ------------------------------------------------------------------ */
/* 문자열 연산과 위치 변환 (OT)                                         */
/* ------------------------------------------------------------------ */

export function applyOp(doc: string, op: Op): string {
  if (op.kind === 'insert') return doc.slice(0, op.at) + op.text + doc.slice(op.at);
  if (op.at < 0 || op.at >= doc.length) return doc;
  return doc.slice(0, op.at) + doc.slice(op.at + 1);
}

const NOOP_DELETE: Op = { kind: 'delete', at: -1 };

/**
 * op 를 against 가 먼저 적용된 문서 기준으로 옮겨요.
 * winsTie 는 같은 자리 삽입이 겹칠 때 op 가 앞자리를 가질지 정해요.
 * 서버 도착 순서가 앞선 쪽이 winsTie 를 가져요. 양쪽 화면이 같은 규칙을 써야 수렴해요.
 */
export function transform(op: Op, against: Op, winsTie: boolean): Op {
  if (op.kind === 'insert' && against.kind === 'insert') {
    if (op.at < against.at) return op;
    if (op.at > against.at) return { ...op, at: op.at + against.text.length };
    return winsTie ? op : { ...op, at: op.at + against.text.length };
  }
  if (op.kind === 'insert' && against.kind === 'delete') {
    return op.at > against.at ? { ...op, at: op.at - 1 } : op;
  }
  if (op.kind === 'delete' && against.kind === 'insert') {
    return op.at >= against.at ? { ...op, at: op.at + against.text.length } : op;
  }
  // delete vs delete
  if (op.at === against.at) return NOOP_DELETE;
  return op.at > against.at ? { ...op, at: op.at - 1 } : op;
}

/* ------------------------------------------------------------------ */
/* 글자 id 기반 (RGA 형태의 단순화)                                     */
/* ------------------------------------------------------------------ */

type Ts = readonly [number, number, number];

interface Char {
  id: string;
  ts: Ts;
  value: string;
  deleted: boolean;
}

interface CrdtOp {
  kind: 'insert' | 'delete';
  /** insert: 새 글자 목록. delete: 지울 글자 id */
  chars?: Char[];
  origin?: string | null;
  target?: string;
}

const ROOT = null;

function cmpTs(a: Ts, b: Ts): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** 기준 문서를 글자 목록으로 바꿔요. 기준 글자 id는 base-0, base-1 … 이에요. */
export function baseChars(text: string = BASE): Char[] {
  return [...text].map((value, i) => ({ id: `base-${i}`, ts: [0, 0, i], value, deleted: false }));
}

/** 사용자 한 명이 만든 연산을 글자 id 연산으로 바꿔요. */
function toCrdt(op: Op, who: Who, base: Char[]): CrdtOp {
  if (op.kind === 'delete') {
    return { kind: 'delete', target: base[op.at].id };
  }
  const rank = who === 'A' ? 0 : 1;
  const chars: Char[] = [...op.text].map((value, k) => ({
    id: `${who}-${k}`,
    ts: [1, rank, k] as Ts,
    value,
    deleted: false,
  }));
  const origin = op.at === 0 ? ROOT : base[op.at - 1].id;
  return { kind: 'insert', chars, origin };
}

function applyCrdt(list: Char[], op: CrdtOp): Char[] {
  if (op.kind === 'delete') {
    return list.map((c) => (c.id === op.target ? { ...c, deleted: true } : c));
  }
  const next = [...list];
  let prev: string | null = op.origin ?? ROOT;
  for (const c of op.chars ?? []) {
    let idx = prev === ROOT ? -1 : next.findIndex((x) => x.id === prev);
    let i = idx + 1;
    // RGA: 같은 자리에서 더 큰 ts 를 가진 글자를 건너뛰어 순서를 정해요.
    while (i < next.length && cmpTs(next[i].ts, c.ts) > 0) i++;
    next.splice(i, 0, c);
    prev = c.id;
  }
  return next;
}

function visible(list: Char[]): string {
  return list
    .filter((c) => !c.deleted)
    .map((c) => c.value)
    .join('');
}

/* ------------------------------------------------------------------ */
/* 세 화면 계산                                                        */
/* ------------------------------------------------------------------ */

export interface Screens {
  server: string;
  a: string;
  b: string;
}

export function runScene(method: Method, combo: Combo, arrival: Arrival): Screens {
  const scene = SCENE[combo];
  const first: Who = arrival === 'a-first' ? 'A' : 'B';
  const second: Who = first === 'A' ? 'B' : 'A';
  const opOf = (who: Who) => (who === 'A' ? scene.a : scene.b);

  if (method === 'overwrite') {
    // 나중에 도착한 쪽의 문서(기준 + 자기 연산)가 서버 값이 돼요. 모든 화면이 그 값을 받아요.
    const last = applyOp(BASE, opOf(second));
    return { server: last, a: last, b: last };
  }

  if (method === 'raw') {
    const server = applyOp(applyOp(BASE, opOf(first)), opOf(second));
    const firstScreen = server;
    const secondScreen = applyOp(applyOp(BASE, opOf(second)), opOf(first));
    return toScreens(first, firstScreen, secondScreen, server);
  }

  if (method === 'ot') {
    const firstOp = opOf(first);
    const secondOp = opOf(second);
    // 서버는 먼저 온 연산을 그대로 적용하고, 나중 연산을 먼저 온 연산 기준으로 고쳐요.
    const secondOnServer = transform(secondOp, firstOp, false);
    const server = applyOp(applyOp(BASE, firstOp), secondOnServer);
    // 나중 연산을 가진 화면은 먼저 온 연산을 자기 연산 기준으로 고쳐 받아요.
    const firstOnSecond = transform(firstOp, secondOp, true);
    const secondScreen = applyOp(applyOp(BASE, secondOp), firstOnSecond);
    return toScreens(first, server, secondScreen, server);
  }

  // crdt: 각 화면은 자기 연산을 먼저 적용하고, 상대 연산을 나중에 받아요.
  const base = baseChars();
  const opA = toCrdt(scene.a, 'A', base);
  const opB = toCrdt(scene.b, 'B', base);
  const firstCrdt = first === 'A' ? opA : opB;
  const secondCrdt = first === 'A' ? opB : opA;
  const serverList = applyCrdt(applyCrdt(base, firstCrdt), secondCrdt);
  const aList = applyCrdt(applyCrdt(base, opA), opB);
  const bList = applyCrdt(applyCrdt(base, opB), opA);
  return { server: visible(serverList), a: visible(aList), b: visible(bList) };
}

/** 먼저 도착한 사용자의 화면은 서버와 같고, 나중 사용자의 화면만 따로 계산해요. */
function toScreens(first: Who, server: string, secondScreen: string, serverDoc: string): Screens {
  if (first === 'A') return { server: serverDoc, a: server, b: secondScreen };
  return { server: serverDoc, a: secondScreen, b: server };
}

/* ------------------------------------------------------------------ */
/* 누구 변경이 남았는지                                                 */
/* ------------------------------------------------------------------ */

export type InsertStatus = '남음' | '깨짐' | '사라짐';
export type DeleteStatus = '반영' | '안 지워짐' | '엉뚱한 글자 지워짐';
export type ChangeStatus = InsertStatus | DeleteStatus;

/** 화면 문자열에서 한 사용자 변경이 살아 있는지 판정해요. */
export function changeStatus(doc: string, who: Who, combo: Combo): ChangeStatus {
  const scene = SCENE[combo];
  const op = who === 'A' ? scene.a : scene.b;
  if (op.kind === 'insert') {
    if (doc.includes(op.text)) return '남음';
    // 첫 글자는 남았는데 글이 붙어 있지 않으면 깨진 것이에요.
    return doc.includes([...op.text][0]) ? '깨짐' : '사라짐';
  }
  if (doc.includes(BASE[op.at])) return '안 지워짐';
  const targets = new Set(deleteTargets(combo));
  const wrong = [...BASE].some((ch) => !doc.includes(ch) && !targets.has(ch));
  return wrong ? '엉뚱한 글자 지워짐' : '반영';
}

/** 장면에서 지우려고 한 기준 글자들이에요. */
export function deleteTargets(combo: Combo): string[] {
  const ops = [SCENE[combo].a, SCENE[combo].b];
  return ops.flatMap((op) => (op.kind === 'delete' ? [BASE[op.at]] : []));
}

export function isConverged(s: Screens): boolean {
  return s.a === s.b && s.a === s.server;
}
