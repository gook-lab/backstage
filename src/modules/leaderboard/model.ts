// 실시간 랭킹 모델. 참가자 점수를 세 방식(DB COUNT · 정렬된 집합 · 구간별 근사)으로 순위 매기고,
// 동점 규칙(이름 순 · 먼저 도달한 사람 우선)에 따라 상위 N 과 페이지 커서를 만든다.
// 모든 숫자는 설명을 위한 예시예요.

export type RankMethod = 'db-count' | 'sorted-set' | 'bucket';
export const METHODS: readonly RankMethod[] = ['db-count', 'sorted-set', 'bucket'];
export const METHOD_LABEL: Record<RankMethod, string> = {
  'db-count': 'DB COUNT',
  'sorted-set': '정렬된 집합',
  bucket: '구간별 근사',
};

export type TieRule = 'member' | 'first-reached';
export const TIE_RULES: readonly TieRule[] = ['first-reached', 'member'];
export const TIE_LABEL: Record<TieRule, string> = {
  'first-reached': '먼저 도달한 사람 우선',
  member: '이름 순 (Redis 기본)',
};

export const MAX_SCORE = 1000;
/** 구간별 근사에서 점수를 묶는 폭. 0~1000 점이면 11개 구간이에요 */
export const BUCKET_WIDTH = 100;
/** 도달 순서 상한. 참가자 수보다 커야 해요 (예시: 100만 명까지 여유) */
export const SPAN = 2 ** 20;

export interface Player {
  id: string;
  score: number;
  /** 도달 순서. 1 부터 시작하고, 작을수록 먼저 도달했어요 */
  arrival: number;
}

export interface Cursor {
  id: string;
  score: number;
  arrival: number;
}

/** 같은 시드는 항상 같은 참가자 모임을 만들어요 */
export function makePlayers(n: number, seed: number): Player[] {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return Array.from({ length: n }, (_, i) => ({
    id: `user-${String(i + 1).padStart(6, '0')}`,
    score: Math.floor(next() * (MAX_SCORE + 1)),
    arrival: order[i] + 1,
  }));
}

/** a 가 b 보다 위에 있으면 true. 점수가 높고, 동점이면 동점 규칙을 따라요 */
export function isAhead(a: Player, b: Player, tie: TieRule): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (tie === 'member') return a.id > b.id; // ZREVRANGE 순서: 같은 점수면 이름이 큰 쪽이 먼저
  return a.arrival < b.arrival;
}

/** 정렬된 집합에 넣을 점수. 먼저 도달한 사람이 위로 오도록 도달 순서를 점수에 섞어요 */
export function encodeScore(p: Player, tie: TieRule): number {
  if (tie === 'member') return p.score;
  return p.score * SPAN + (SPAN - 1 - p.arrival);
}

export function ranking(players: readonly Player[], tie: TieRule): Player[] {
  return [...players].sort((a, b) => (isAhead(a, b, tie) ? -1 : isAhead(b, a, tie) ? 1 : 0));
}

export function topN(players: readonly Player[], n: number, tie: TieRule): Player[] {
  return ranking(players, tie).slice(0, n);
}

/** 커서 다음 페이지. 커서보다 뒤에 있는 행을 점수 · 도달 순서 기준으로 이어서 읽어요 */
export function pageAfter(players: readonly Player[], cursor: Cursor | null, size: number, tie: TieRule): Player[] {
  const sorted = ranking(players, tie);
  if (!cursor) return sorted.slice(0, size);
  const start = sorted.findIndex((p) => p.id === cursor.id);
  return sorted.slice(start + 1, start + 1 + size);
}

export interface RankResult {
  /** 정확한 순위(정렬된 집합 · DB COUNT) 또는 근사 구간의 아래쪽 */
  low: number;
  /** 근사 구간의 위쪽. 정확하면 low 와 같아요 */
  high: number;
  /** 읽는 항목 수 (예시). 방식마다 무엇을 세거나 읽는지가 달라요 */
  reads: number;
  exact: boolean;
}

export function rankOf(players: readonly Player[], me: Player, method: RankMethod, tie: TieRule): RankResult {
  if (method === 'db-count') {
    // 내 점수보다 앞선 행을 전부 세야 해요. 인덱스가 있어도 범위의 항목을 읽어요.
    const ahead = players.filter((p) => p.id !== me.id && isAhead(p, me, tie)).length;
    return { low: ahead + 1, high: ahead + 1, reads: ahead, exact: true };
  }

  if (method === 'sorted-set') {
    // 정렬된 집합은 점수 순서를 이미 갖고 있어요. 순위 조회는 로그 단계로 끝나요 (예시: 트리 단계 수).
    const order = zsetOrder(players, tie);
    const rank = order.indexOf(me.id) + 1;
    return { low: rank, high: rank, reads: Math.ceil(Math.log2(players.length + 1)), exact: true };
  }

  // 구간별 근사: 점수 구간마다 인원수만 들고 있고, 내 구간보다 높은 구간의 합으로 순위를 잡아요.
  const myBucket = bucketOf(me.score);
  const counts = new Map<number, number>();
  let above = 0;
  for (const p of players) {
    const b = bucketOf(p.score);
    counts.set(b, (counts.get(b) ?? 0) + 1);
    if (b > myBucket) above += 1;
  }
  const sameBucket = counts.get(myBucket) ?? 1;
  const low = above + 1;
  const high = above + sameBucket;
  const topBucket = bucketOf(MAX_SCORE);
  return { low, high, reads: topBucket - myBucket + 1, exact: low === high };
}

function bucketOf(score: number): number {
  return Math.floor(score / BUCKET_WIDTH);
}

/** Redis 정렬된 집합의 ZREVRANGE 순서 (점수 내림차순, 같으면 멤버 내림차순) */
export function zsetOrder(players: readonly Player[], tie: TieRule): string[] {
  const entries = players.map((p) => ({ member: p.id, score: encodeScore(p, tie) }));
  entries.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.member > b.member ? -1 : a.member < b.member ? 1 : 0;
  });
  return entries.map((e) => e.member);
}

/** 같은 점수 안에서 내 주변 사람을 보여 줄 때 쓰는 목록 */
export function tieGroup(players: readonly Player[], me: Player, tie: TieRule): Player[] {
  return ranking(
    players.filter((p) => p.score === me.score),
    tie,
  );
}

// ---- 주기별 랭킹 키 ----

export interface PeriodKeys {
  daily: string;
  weekly: string;
}

function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 주간 키는 UTC 기준 월요일 날짜로 정해요 (예시 규칙) */
export function periodKeys(now: Date): PeriodKeys {
  const day = now.getUTCDay(); // 0 = 일요일
  const sinceMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday));
  return {
    daily: `rank:daily:${utcDate(now)}`,
    weekly: `rank:weekly:${utcDate(monday)}`,
  };
}

/** 주기가 끝난 뒤 키를 남겨 두는 기간 (예시). 이 시간이 지나면 키가 사라져요 */
export const PERIOD_TTL_SECONDS = { daily: 2 * 24 * 60 * 60, weekly: 9 * 24 * 60 * 60 } as const;

// ---- DB 와 랭킹 저장소의 어긋남 ----

export interface Drift {
  /** DB 에는 있는데 랭킹 저장소에 없는 참가자 */
  missing: string[];
  /** 두 쪽 모두 있지만 점수가 다른 참가자 */
  stale: string[];
  /** 랭킹 저장소에만 남은 참가자 */
  extra: string[];
}

export function diffRanking(db: ReadonlyMap<string, number>, zset: ReadonlyMap<string, number>): Drift {
  const missing: string[] = [];
  const stale: string[] = [];
  const extra: string[] = [];
  for (const [id, score] of db) {
    if (!zset.has(id)) missing.push(id);
    else if (zset.get(id) !== score) stale.push(id);
  }
  for (const id of zset.keys()) {
    if (!db.has(id)) extra.push(id);
  }
  return { missing: missing.sort(), stale: stale.sort(), extra: extra.sort() };
}

/** 재구축: DB 를 원본으로 삼아 랭킹 저장소를 처음부터 다시 채워요 */
export function rebuildRanking(db: ReadonlyMap<string, number>): Map<string, number> {
  return new Map(db);
}

// ---- 점수는 서버가 계산 ----

/** 서버가 가진 행동별 점수표 (예시). 클라이언트는 점수가 아니라 행동 이름만 보내요 */
export const ACTION_POINTS: Readonly<Record<string, number>> = { correct: 10, streak: 5, event: 100 };

export type ScoreResult = { ok: true; score: number } | { ok: false; action: string };

export function scoreFromActions(actions: readonly string[]): ScoreResult {
  let score = 0;
  for (const action of actions) {
    if (!Object.hasOwn(ACTION_POINTS, action)) return { ok: false, action };
    score += ACTION_POINTS[action];
  }
  return { ok: true, score };
}
