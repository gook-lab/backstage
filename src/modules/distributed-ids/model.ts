export type IdScheme = 'serial' | 'uuid-v4' | 'uuid-v7' | 'int64';

export const SCHEMES: readonly IdScheme[] = ['serial', 'uuid-v4', 'uuid-v7', 'int64'];

export const SCHEME_LABEL: Record<IdScheme, string> = {
  serial: '자동 증가 (bigint)',
  'uuid-v4': 'UUID v4 (무작위)',
  'uuid-v7': 'UUID v7 (시간 순)',
  int64: '64비트 정수 (예시 구조)',
};

export const SCHEME_HINT: Record<IdScheme, string> = {
  serial: '한 DB 가 번호를 하나씩 붙여요. 값이 1, 2, 3 으로 이어지고, 롤백된 번호는 돌아오지 않아요.',
  'uuid-v4': '값이 무작위예요. 어디서 만들어도 겹치지 않을 가능성이 높고, 순서에서는 아무 정보도 없어요.',
  'uuid-v7': '앞부분에 밀리초 시각이 있어서 생성 순서와 거의 같아요. 같은 밀리초 안에서는 순서가 섞일 수 있어요.',
  int64: '시각 + 서버 번호 + 순번을 64비트 정수 하나에 담아요. 비트 배치는 구현마다 달라서 예시예요.',
};

export const BASE_MS = Date.UTC(2026, 10, 23, 9, 0, 0);
const EPOCH_MS = Date.UTC(2026, 0, 1);
const MACHINE = 3n;

export interface Params {
  readonly scheme: IdScheme;
  readonly count: number;
  /** 0 이상 1 이하. 자동 증가에서만 빈 번호를 만들어요 */
  readonly rollbackRate: number;
  /** UUID v7 에서 같은 밀리초 안의 순서를 카운터로 잡을지 (RFC 9562 §6.2) */
  readonly monotonicV7: boolean;
  readonly seed: number;
}

export interface Row {
  /** 생성 순서. 1 부터 */
  readonly order: number;
  readonly key: string;
  readonly atMs: number;
  /** 정렬했을 때 자리. 1 부터 */
  readonly rank: number;
}

export interface Result {
  readonly rows: readonly Row[];
  /** 롤백돼서 되돌아오지 않은 번호 수 */
  readonly gaps: number;
  /** 생성 순서의 인접한 두 값이 오름차순으로 정렬되는 비율 */
  readonly sortedMatch: number;
  /** 이전 값에 1 을 더해 다음 값을 맞힌 비율 (가장 단순한 추측) */
  readonly guessHit: number;
  /** JS Number 로 읽었을 때 값이 바뀌는 ID 수. 숫자 방식에서만 셉니다 */
  readonly precisionLoss: number;
  /** 새 값이 지금까지 모든 값보다 뒤에 붙은 비율 */
  readonly appendShare: number;
  /** 새 값이 들어간 자리를 기존 값의 앞쪽 4구간으로 나눈 비율 */
  readonly insertShares: readonly number[];
}

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

function hex(rnd: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(rnd() * 16).toString(16);
  return s;
}

function variantHex(rnd: () => number): string {
  return '89ab'[Math.floor(rnd() * 4)] ?? '8';
}

function uuidV4(rnd: () => number): string {
  return `${hex(rnd, 8)}-${hex(rnd, 4)}-4${hex(rnd, 3)}-${variantHex(rnd)}${hex(rnd, 3)}-${hex(rnd, 12)}`;
}

/** counter 가 있으면 rand_a 자리를 같은 밀리초 안의 카운터로 써요 */
function uuidV7(rnd: () => number, ms: number, counter: number | null): string {
  const t = ms.toString(16).padStart(12, '0');
  const randA = counter === null ? hex(rnd, 3) : counter.toString(16).padStart(3, '0');
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${randA}-${variantHex(rnd)}${hex(rnd, 3)}-${hex(rnd, 12)}`;
}

function snowflake(ms: number, seq: number): string {
  const rel = BigInt(ms - EPOCH_MS);
  return ((rel << 22n) | (MACHINE << 12n) | BigInt(seq)).toString();
}

/** 사전순 비교. 숫자 문자열은 길이 먼저, UUID 는 길이가 같아서 사전순과 같아요 */
export function compareKeys(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 가장 단순한 추측: 이전 값에 1 을 더한다. UUID 는 끝 4자리에 1 을 더해 봐요 */
export function naiveNext(prev: string, scheme: IdScheme): string {
  if (scheme === 'serial' || scheme === 'int64') return (BigInt(prev) + 1n).toString();
  const head = prev.slice(0, -4);
  const tail = (Number.parseInt(prev.slice(-4), 16) + 1) % 0x10000;
  return head + tail.toString(16).padStart(4, '0');
}

export function generate(p: Params): Result {
  const rnd = mulberry32(p.seed);
  const raw: { key: string; atMs: number }[] = [];
  let gaps = 0;
  let nextSerial = 1;
  let ms = BASE_MS;
  let lastMs = -1;
  let seq = 0;

  for (let i = 0; i < p.count; i++) {
    ms += Math.floor(rnd() * 3);
    if (ms === lastMs) seq++;
    else {
      seq = 0;
      lastMs = ms;
    }

    let key: string;
    if (p.scheme === 'serial') {
      while (rnd() < p.rollbackRate) {
        nextSerial++;
        gaps++;
      }
      key = String(nextSerial++);
    } else if (p.scheme === 'uuid-v4') {
      key = uuidV4(rnd);
    } else if (p.scheme === 'uuid-v7') {
      key = uuidV7(rnd, ms, p.monotonicV7 ? seq : null);
    } else {
      key = snowflake(ms, seq);
    }
    raw.push({ key, atMs: ms });
  }

  const order = raw.map((_, i) => i).sort((a, b) => compareKeys(raw[a].key, raw[b].key));
  const rankOf = new Array<number>(raw.length);
  order.forEach((idx, k) => {
    rankOf[idx] = k + 1;
  });
  const rows: Row[] = raw.map((r, i) => ({ order: i + 1, key: r.key, atMs: r.atMs, rank: rankOf[i] }));

  const n = rows.length;
  let ascending = 0;
  for (let i = 0; i < n - 1; i++) {
    if (compareKeys(rows[i].key, rows[i + 1].key) < 0) ascending++;
  }
  const sortedMatch = n > 1 ? ascending / (n - 1) : 1;

  let guessed = 0;
  for (let i = 1; i < n; i++) {
    if (naiveNext(rows[i - 1].key, p.scheme) === rows[i].key) guessed++;
  }
  const guessHit = n > 1 ? guessed / (n - 1) : 0;

  const numeric = p.scheme === 'serial' || p.scheme === 'int64';
  const precisionLoss = numeric ? rows.filter((r) => String(Number(r.key)) !== r.key).length : 0;

  let appended = 0;
  const buckets = [0, 0, 0, 0];
  for (let i = 1; i < n; i++) {
    const key = rows[i].key;
    let smaller = 0;
    for (let j = 0; j < i; j++) {
      if (compareKeys(rows[j].key, key) < 0) smaller++;
    }
    if (smaller === i) appended++;
    buckets[Math.min(3, Math.floor((smaller / i) * 4))]++;
  }
  const inserts = Math.max(1, n - 1);

  return {
    rows,
    gaps,
    sortedMatch,
    guessHit,
    precisionLoss,
    appendShare: appended / inserts,
    insertShares: buckets.map((b) => b / inserts),
  };
}
