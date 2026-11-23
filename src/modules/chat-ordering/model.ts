/**
 * 채팅 순서 · 안 읽은 수 모델 (예시 값으로 돌리는 순수 함수)
 *
 * 한 방에서 '나 폰', '나 노트북', '상대 폰' 세 기기가 같은 대화를 본다고 가정해요.
 * 시간 단위는 밀리초, 메시지 순서는 SCRIPT 의 보낸 시각(sendAt)으로 고정해요.
 */

export type Sender = 'me' | 'peer';
export type Viewer = 'phone' | 'laptop' | 'peer';
/** client: 보낸 기기 시계 · arrival: 서버 수신 시각(초 단위 기록) · received: 기기가 받은 순서 · seq: 서버 순번 */
export type SortBy = 'client' | 'arrival' | 'received' | 'seq';
export type ReadSync = 'server' | 'local';

export interface Message {
  readonly id: string;
  readonly from: Sender;
  /** 실제 시간 기준 보낸 시각 (ms). 기기 시계 오차는 여기에 더해져요 */
  readonly sendAt: number;
  readonly text: string;
}

export const SCRIPT: readonly Message[] = [
  { id: 'P1', from: 'peer', sendAt: 1000, text: '어디예요?' },
  { id: 'M1', from: 'me', sendAt: 1500, text: '2층이요' },
  { id: 'P2', from: 'peer', sendAt: 2000, text: '거의 다 왔어요' },
  { id: 'M2', from: 'me', sendAt: 2400, text: '기다릴게요' },
  { id: 'P3', from: 'peer', sendAt: 4000, text: '들어갈게요' },
];

export const LABEL: Readonly<Record<string, string>> = {
  P1: '상대 1',
  M1: '내 1',
  P2: '상대 2',
  M2: '내 2',
  P3: '상대 3',
};

/** 노트북 연결이 끊기는 구간 (ms) */
export const OFFLINE = { from: 2500, to: 4000 } as const;
/** 노트북이 채팅방을 여는 시각. 이때까지 받은 마지막 순번을 읽음 위치로 보내요 */
export const LAPTOP_READ_AT = 2000;
/** 읽음 위치를 기기 안에만 둘 때, 나 폰이 알고 있는 마지막 읽은 위치 */
export const PHONE_LOCAL_READ = 0;
/** 나 폰이 ACK 를 받지 못해 다시 보내는 메시지 */
export const RETRY_ID = 'M2';
export const RETRY_AFTER = 3000;

export interface Config {
  readonly sortBy: SortBy;
  /** 나 폰 시계 오차 (초). 양수면 시계가 빨라요 */
  readonly meSkew: number;
  /** 상대 폰 시계 오차 (초) */
  readonly peerSkew: number;
  /** 나 폰 → 서버 지연 (ms) */
  readonly meDelay: number;
  /** 상대 폰 → 서버 지연 (ms) */
  readonly peerDelay: number;
  /** 노트북 연결이 끊기는 구간을 켤지 */
  readonly offline: boolean;
  /** 재연결 뒤 마지막 순번 이후를 요청해 빈 구간을 채울지 */
  readonly fill: boolean;
  /** 나 폰이 ACK 를 못 받아 RETRY_ID 를 다시 보낼지 */
  readonly retry: boolean;
  /** 서버가 클라이언트 메시지 id 로 중복 전송을 거를지 */
  readonly dedupe: boolean;
  readonly readSync: ReadSync;
}

export const DEFAULT_CONFIG: Config = {
  sortBy: 'seq',
  meSkew: 0,
  peerSkew: 0,
  meDelay: 300,
  peerDelay: 300,
  offline: false,
  fill: false,
  retry: false,
  dedupe: true,
  readSync: 'server',
};

export interface Stored {
  /** 서버가 방 단위로 붙인 순번. 도착한 순서대로 1, 2, 3 … */
  readonly seq: number;
  readonly id: string;
  readonly from: Sender;
  readonly text: string;
  /** 보낸 기기 시계로 찍은 시각 (ms) */
  readonly clientTs: number;
  /** 서버에 도착한 실제 시각 (ms) */
  readonly arrival: number;
  /** 같은 id 의 두 번째 저장이면 true */
  readonly dup: boolean;
}

export interface View {
  readonly viewer: Viewer;
  readonly label: string;
  /** 이 기기가 받은 메시지를 정렬 기준으로 나열한 목록 */
  readonly rows: readonly Stored[];
  /** 받지 못한 메시지 id */
  readonly missing: readonly string[];
  /** 안 읽은 상대 메시지 수. 상대 기기는 null */
  readonly unread: number | null;
  readonly lastRead: number | null;
}

export interface Moved {
  readonly id: string;
  /** 전송 직후 화면에 보인 위치 (1부터) */
  readonly provisional: number;
  /** 새로고침 뒤 위치 (1부터) */
  readonly final: number;
}

export interface Result {
  readonly records: readonly Stored[];
  readonly views: readonly View[];
  readonly moved: readonly Moved[];
  readonly duplicates: number;
  readonly orderMismatch: boolean;
  readonly notes: readonly string[];
}

const sign = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const skewMs = (m: Message, c: Config) => (m.from === 'me' ? c.meSkew : c.peerSkew) * 1000;
const delayOf = (m: Message, c: Config) => (m.from === 'me' ? c.meDelay : c.peerDelay);

interface Send {
  readonly id: string;
  readonly from: Sender;
  readonly text: string;
  readonly clientTs: number;
  readonly arrival: number;
}

/** 서버 도착 순서로 정렬된 전송 시도 목록. 재시도는 같은 id 와 같은 clientTs 를 가져요 */
function sends(c: Config): Send[] {
  const out: Send[] = [];
  for (const m of SCRIPT) {
    const base = { id: m.id, from: m.from, text: m.text, clientTs: m.sendAt + skewMs(m, c) };
    out.push({ ...base, arrival: m.sendAt + delayOf(m, c) });
    if (c.retry && m.id === RETRY_ID) {
      out.push({ ...base, arrival: m.sendAt + RETRY_AFTER + delayOf(m, c) });
    }
  }
  return out.sort((a, b) => sign(a.arrival, b.arrival) || byId(a.id, b.id));
}

/** 서버가 방 단위 순번을 붙이며 저장한 기록 */
function store(c: Config): Stored[] {
  const out: Stored[] = [];
  const seen = new Set<string>();
  for (const s of sends(c)) {
    const dup = seen.has(s.id);
    if (dup && c.dedupe) continue;
    seen.add(s.id);
    out.push({ seq: out.length + 1, ...s, dup });
  }
  return out;
}

const inOffline = (r: Stored) => r.arrival >= OFFLINE.from && r.arrival < OFFLINE.to;

/** 기기가 실제로 받은 메시지 */
function received(viewer: Viewer, all: readonly Stored[], c: Config): Stored[] {
  if (viewer !== 'laptop' || !c.offline) return [...all];
  return all.filter((r) => !inOffline(r) || c.fill);
}

/** 기기가 메시지를 받은 시각. 재연결로 채운 메시지는 재연결 시각에 받아요 */
function receiptOf(viewer: Viewer, r: Stored, c: Config): number {
  if (viewer === 'laptop' && c.offline && c.fill && inOffline(r)) return OFFLINE.to;
  return r.arrival;
}

function sortKey(r: Stored, by: SortBy, receipt: number): [number, string] {
  if (by === 'seq') return [r.seq, ''];
  if (by === 'arrival') return [Math.floor(r.arrival / 1000), r.id];
  if (by === 'received') return [receipt, r.id];
  return [r.clientTs, r.id];
}

function orderRows(rows: readonly Stored[], by: SortBy, receipt: (r: Stored) => number): Stored[] {
  return [...rows].sort((a, b) => {
    const ka = sortKey(a, by, receipt(a));
    const kb = sortKey(b, by, receipt(b));
    return sign(ka[0], kb[0]) || byId(ka[1], kb[1]);
  });
}

const VIEWERS: readonly { viewer: Viewer; label: string }[] = [
  { viewer: 'phone', label: '나 · 폰' },
  { viewer: 'laptop', label: '나 · 노트북' },
  { viewer: 'peer', label: '상대 · 폰' },
];

export function simulate(c: Config): Result {
  const all = store(c);
  const duplicates = all.filter((r) => r.dup).length;

  // 읽음 위치: 노트북이 LAPTOP_READ_AT 에 본 가장 큰 순번
  const readMarker = all.filter((r) => r.arrival <= LAPTOP_READ_AT).reduce((mx, r) => Math.max(mx, r.seq), 0);

  const views: View[] = VIEWERS.map(({ viewer, label }) => {
    const got = received(viewer, all, c);
    const receipt = (r: Stored) => receiptOf(viewer, r, c);
    const rows = orderRows(got, c.sortBy, receipt);
    const missing = SCRIPT.map((m) => m.id).filter((id) => !got.some((r) => r.id === id));

    let lastRead: number | null = null;
    if (viewer === 'laptop') lastRead = readMarker;
    if (viewer === 'phone') lastRead = c.readSync === 'server' ? readMarker : PHONE_LOCAL_READ;
    const unread = lastRead === null ? null : got.filter((r) => r.from === 'peer' && r.seq > lastRead!).length;
    return { viewer, label, rows, missing, unread, lastRead };
  });

  // 낙관적 전송: 보내는 순간 화면에 있던 메시지 + 내 메시지(정렬 기준에 따라 위치 결정)
  const phone = views.find((v) => v.viewer === 'phone')!;
  const moved: Moved[] = [];
  for (const m of SCRIPT.filter((x) => x.from === 'me')) {
    const own = all.find((r) => r.id === m.id)!;
    const known = phone.rows.filter((r) => r.id !== m.id && r.arrival <= m.sendAt);
    const list =
      c.sortBy === 'client'
        ? orderRows([...known, own], 'client', (r) => r.arrival)
        : [...orderRows(known, c.sortBy, (r) => receiptOf('phone', r, c)), own];
    const provisional = list.findIndex((r) => r.id === m.id) + 1;
    const final = phone.rows.findIndex((r) => r.id === m.id) + 1;
    moved.push({ id: m.id, provisional, final });
  }

  // 기기마다 순서가 달라졌는지: 모든 기기가 받은 메시지만 비교
  const commonIds = new Set(
    SCRIPT.map((m) => m.id).filter((id) => views.every((v) => v.rows.some((r) => r.id === id))),
  );
  const orderOf = (v: View) =>
    v.rows
      .filter((r) => commonIds.has(r.id))
      .map((r) => r.id)
      .join(',');
  const orderMismatch = new Set(views.map(orderOf)).size > 1;

  const notes: string[] = [];
  if (duplicates > 0) {
    notes.push(`같은 메시지가 서버에 ${duplicates}번 더 저장됐어요. 클라이언트 메시지 id로 거르지 않았기 때문이에요.`);
  }
  if (c.dedupe && c.retry) {
    notes.push('재전송은 같은 메시지 id라서 서버가 처음 받은 순번을 그대로 돌려줘요.');
  }
  const laptop = views.find((v) => v.viewer === 'laptop')!;
  if (laptop.missing.length > 0) {
    const names = laptop.missing.map((id) => LABEL[id]).join(', ');
    notes.push(`노트북은 ${names} 메시지를 받지 못했어요. 재연결 뒤 빈 구간을 채우지 않았기 때문이에요.`);
  }
  const bySeq = orderRows(phone.rows, 'seq', () => 0)
    .map((r) => r.id)
    .join(',');
  if (c.sortBy !== 'seq' && phone.rows.map((r) => r.id).join(',') !== bySeq) {
    notes.push('이 정렬 기준은 서버 순번과 달라요. 보낸 기기 시계나 받은 시각을 그대로 쓰기 때문이에요.');
  }
  for (const mv of moved) {
    if (mv.provisional !== mv.final) {
      notes.push(
        `${LABEL[mv.id]} 메시지는 전송 직후 ${mv.provisional}번째에 보였다가 새로고침 뒤 ${mv.final}번째로 옮겨 가요.`,
      );
    }
  }
  if (phone.unread !== laptop.unread) {
    notes.push(`나 폰의 안 읽은 수(${phone.unread}개)와 노트북(${laptop.unread}개)이 달라요.`);
  }
  if (orderMismatch) notes.push('기기마다 순서가 달라요.');
  if (notes.length === 0) notes.push('모든 기기가 같은 순서와 같은 안 읽은 수를 보여요.');

  return { records: all, views, moved, duplicates, orderMismatch, notes };
}
