/** 샤드 키 분할 · 샤드를 넘는 조회 · 재샤딩 이동량을 계산하는 순수 모델. 수치는 모두 예시예요. */

export type Method = 'range' | 'hash';
export type Query = 'member' | 'latest' | 'dateRange';

export const METHODS: readonly { id: Method; label: string; summary: string }[] = [
  {
    id: 'range',
    label: '범위 분할 (회원 id 구간)',
    summary:
      '회원 id가 가까우면 같은 샤드에 모여요. 최근 가입자처럼 id가 계속 커지는 회원이 몰리면 마지막 샤드에 쏠려요.',
  },
  {
    id: 'hash',
    label: '해시 분할 (해시 값을 샤드 수로 나누기)',
    summary: '해시 값으로 고르게 흩어요. 쏠림은 줄지만 id 구간으로 묶인 조회는 여러 샤드에 물어야 해요.',
  },
];

export const QUERIES: readonly { id: Query; label: string; summary: string }[] = [
  {
    id: 'member',
    label: '회원 한 명의 최신 주문 20건',
    summary: '샤드 키인 회원 id 조건이 있어요. 그 회원의 샤드 하나만 물으면 돼요.',
  },
  {
    id: 'latest',
    label: '전체 주문 최신순 (관리자 목록)',
    summary: '샤드 키 조건이 없어요. 모든 샤드에 물어서 각 샤드의 상위 행을 받아 합쳐야 해요.',
  },
  {
    id: 'dateRange',
    label: '최근 날짜 범위 주문',
    summary: '날짜는 샤드 키가 아니에요. 모든 샤드가 조건에 맞는 행을 찾아 올려 보내요.',
  },
];

export const MEMBERS = 2000;
export const ORDERS = 20000;
export const PAGE_SIZE = 20;
/** 날짜 범위 조회가 잡는 최근 주문의 비율 */
export const DATE_WINDOW = 0.02;
/** 일관 해싱에서 샤드 하나가 가지는 가상 노드 수 */
export const VNODES = 400;
export const MAX_SHARDS = 12;
export const MAX_PAGE = 5;

export interface Params {
  /** 샤드 수 (1 ~ 12) */
  readonly shards: number;
  readonly method: Method;
  readonly query: Query;
  /** 최신순 목록의 페이지 번호 (1 ~ 5). 최신순 조회에서만 씀 */
  readonly page: number;
  /** 최근 가입 회원(id 상위 10%)이 주문하는 비율 (0 ~ 90) */
  readonly recentPct: number;
  readonly seed: number;
}

export interface Result {
  /** 샤드별 주문 수 (전체 주문 기준) */
  readonly shardRows: readonly number[];
  /** 조회에 들어간 샤드 인덱스 */
  readonly touched: readonly number[];
  /** 샤드에서 라우터(또는 앱)로 올라와 합쳐지는 행 수 */
  readonly merged: number;
  /** 화면에 보여 주는 행 수 */
  readonly returned: number;
  /** 샤드 키 조건으로 한 샤드에서 끝나는지 */
  readonly targeted: boolean;
  /** 최대 샤드 ÷ 샤드 평균 */
  readonly skew: number;
  /** 가장 많이 쌓인 샤드 인덱스 */
  readonly hotShard: number;
}

/** mulberry32: 같은 시드면 같은 순서로 돌아가는 작은 난수 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** murmur3 의 32비트 마무리 함수. 정수 키를 고르게 섞어요 */
export function fmix32(input: number): number {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 회원 id 를 해시 값으로 바꿔요 */
export function keyHash(key: number): number {
  return fmix32((key + 0x9e3779b9) >>> 0);
}

/** 주문마다 회원 id 를 정해요. 주문 순서가 곧 생성 순서(오래된 순)예요. */
export function buildOrders(seed: number, recentPct: number): number[] {
  const random = rng(seed);
  const recentFrom = Math.floor(MEMBERS * 0.9) + 1;
  const orders: number[] = [];
  for (let i = 0; i < ORDERS; i++) {
    const recent = random() * 100 < recentPct;
    const member = recent
      ? recentFrom + Math.floor(random() * (MEMBERS - recentFrom + 1))
      : 1 + Math.floor(random() * MEMBERS);
    orders.push(member);
  }
  return orders;
}

export function shardOfMember(member: number, shards: number, method: Method): number {
  if (method === 'range') return Math.floor(((member - 1) * shards) / MEMBERS);
  return keyHash(member) % shards;
}

export function simulate(p: Params): Result {
  const orders = buildOrders(p.seed, p.recentPct);
  const perShard: number[][] = Array.from({ length: p.shards }, () => []);
  const counts = new Map<number, number>();
  orders.forEach((member, index) => {
    perShard[shardOfMember(member, p.shards, p.method)].push(index);
    counts.set(member, (counts.get(member) ?? 0) + 1);
  });

  const shardRows = perShard.map((rows) => rows.length);
  const average = ORDERS / p.shards;
  const hotShard = shardRows.indexOf(Math.max(...shardRows));
  const skew = Math.max(...shardRows) / average;
  const all = perShard.map((_, i) => i);

  if (p.query === 'member') {
    let anchor = 1;
    for (const [member, n] of counts) {
      const best = counts.get(anchor) ?? 0;
      if (n > best || (n === best && member < anchor)) anchor = member;
    }
    const merged = Math.min(counts.get(anchor) ?? 0, PAGE_SIZE);
    return {
      shardRows,
      touched: [shardOfMember(anchor, p.shards, p.method)],
      merged,
      returned: merged,
      targeted: true,
      skew,
      hotShard,
    };
  }

  if (p.query === 'latest') {
    const want = p.page * PAGE_SIZE;
    // 각 샤드는 자기 행 중 최신 want 건만 올려 보내요. 합친 뒤 page 구간을 잘라요.
    const merged = perShard.reduce((sum, rows) => sum + Math.min(rows.length, want), 0);
    return {
      shardRows,
      touched: all,
      merged,
      returned: Math.min(PAGE_SIZE, Math.max(0, ORDERS - (p.page - 1) * PAGE_SIZE)),
      targeted: false,
      skew,
      hotShard,
    };
  }

  const windowStart = ORDERS - Math.round(ORDERS * DATE_WINDOW);
  const matched = perShard.reduce((sum, rows) => sum + rows.filter((index) => index >= windowStart).length, 0);
  return {
    shardRows,
    touched: all,
    merged: matched,
    returned: Math.min(PAGE_SIZE, matched),
    targeted: false,
    skew,
    hotShard,
  };
}

export type Scheme = 'modulo' | 'ring';

export interface Move {
  /** 옮겨진 키 비율 (0 ~ 1) */
  readonly ratio: number;
  /** 옮겨진 키가 모두 새로 생긴 샤드(from ~ to-1)로만 갔는지 */
  readonly toNewOnly: boolean;
}

interface RingPoint {
  readonly pos: number;
  readonly shard: number;
}

/** 샤드 n 개로 만든 해시 링. 샤드 하나가 VNODES 개의 점을 가져요 */
export function buildRing(n: number): RingPoint[] {
  const points: RingPoint[] = [];
  for (let s = 0; s < n; s++) {
    for (let v = 0; v < VNODES; v++) {
      points.push({ pos: fmix32(Math.imul(s + 1, 0x27d4eb2d) ^ fmix32(v + 0x165667b1)), shard: s });
    }
  }
  return points.sort((a, b) => a.pos - b.pos);
}

export function ringOwner(ring: readonly RingPoint[], key: number): number {
  const h = keyHash(key);
  let lo = 0;
  let hi = ring.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ring[mid].pos < h) lo = mid + 1;
    else hi = mid;
  }
  return ring[lo % ring.length].shard;
}

/** 샤드 from 개에서 to 개로 늘릴 때 옮겨지는 키의 비율 */
export function movedRatio(scheme: Scheme, from: number, to: number, keys: readonly number[]): Move {
  const ringFrom = scheme === 'ring' ? buildRing(from) : [];
  const ringTo = scheme === 'ring' ? buildRing(to) : [];
  let moved = 0;
  let toNewOnly = true;
  for (const key of keys) {
    const before = scheme === 'ring' ? ringOwner(ringFrom, key) : keyHash(key) % from;
    const after = scheme === 'ring' ? ringOwner(ringTo, key) : keyHash(key) % to;
    if (before !== after) {
      moved++;
      if (after < from) toNewOnly = false;
    }
  }
  return { ratio: keys.length === 0 ? 0 : moved / keys.length, toNewOnly };
}

/** 시뮬레이터가 재샤딩 예시로 쓰는 키 2만 개 */
export const RESHARD_KEYS: readonly number[] = Array.from({ length: 20000 }, (_, i) => i + 1);
