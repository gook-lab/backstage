export const PAGE_SIZE = 10;
/** 받은편지함에 남기는 최대 글 수. 가장 최근 것부터 남긴다 */
export const INBOX_CAP = 50;
export const RECENT_PER_USER = 3;
/** 0번 사용자는 항상 가장 많이 팔로워받는 사용자로 만든다 */
export const CELEB_AUTHOR = 0;

export const DEFAULTS = { users: 120, seed: 7, celebrityAt: 40, activePct: 100, writeRate: 5000, postsPerSec: 10 };

export type Strategy = 'pull' | 'push' | 'hybrid';
export const STRATEGIES: readonly Strategy[] = ['pull', 'push', 'hybrid'];

export const STRATEGY_NAME: Record<Strategy, string> = {
  pull: '당겨 읽기 (pull)',
  push: '밀어 넣기 (push)',
  hybrid: '하이브리드',
};

export const STRATEGY_TEXT: Record<Strategy, string> = {
  pull: '글을 쓸 때는 아무것도 쓰지 않고, 열 때 팔로우한 사람 수만큼 질의해서 합쳐요.',
  push: '글 한 건이 팔로워 수만큼 받은편지함에 들어가요. 열 때는 받은편지함과 글 가져오기 두 번이면 돼요.',
  hybrid: '일반 사용자 글은 받은편지함에 밀어 넣고, 유명 사용자 글은 열 때 따로 당겨 와서 합쳐요.',
};

export interface Post {
  id: number;
  authorId: number;
  createdAt: number;
}

export interface Graph {
  count: number;
  /** followers[u]: u 를 팔로우하는 사용자 */
  followers: number[][];
  /** followees[u]: u 가 팔로우하는 사용자 */
  followees: number[][];
  /** recent[u]: u 가 최근에 쓴 글. 항상 최신순 */
  recent: Post[][];
  /** 0 이상 1 미만. activeShare 보다 작은 사용자만 활성 */
  activity: number[];
}

export interface Params {
  users: number;
  seed: number;
  /** 팔로워가 이 수 이상이면 유명 사용자로 본다 */
  celebrityAt: number;
  /** 0 이상 1 이하. 이 비율의 사용자만 활성 상태로 쓰기를 받는다 */
  activeShare: number;
}

export interface Load {
  /** DB 질의 수 */
  queries: number;
  /** 다시 당겨 온 경우. 비활성 사용자는 받은편지함이 낡아 있다고 보고 한 번 당겨 와요 */
  rebuilt: boolean;
  shown: Post[];
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function compareDesc(a: Post, b: Post): number {
  return b.createdAt - a.createdAt || b.id - a.id;
}

/** 팔로워 수가 거듭제곱 분포를 따르도록 만든 결정적 소셜 그래프. 같은 입력이면 항상 같은 그래프가 나온다 */
export function makeGraph(users: number, seed: number): Graph {
  const next = rng(seed);
  const top = Math.floor((users - 1) * 0.6);

  const followers = Array.from({ length: users }, (_, u) => {
    const want = Math.min(users - 1, 4 + Math.round(top / (u + 1) ** 1.1));
    const pool = Array.from({ length: users - 1 }, (_, i) => (i < u ? i : i + 1));
    for (let k = 0; k < want; k++) {
      const j = k + Math.floor(next() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    return pool.slice(0, want).sort((a, b) => a - b);
  });

  const followees: number[][] = Array.from({ length: users }, () => []);
  followers.forEach((list, u) => list.forEach((f) => followees[f].push(u)));

  const activity = Array.from({ length: users }, () => next());

  const recent = Array.from({ length: users }, (_, u) =>
    Array.from({ length: RECENT_PER_USER }, (_, j) => ({
      id: u * RECENT_PER_USER + j + 1,
      authorId: u,
      createdAt: Math.floor(next() * 1000),
    })).sort(compareDesc),
  );

  return { count: users, followers, followees, recent, activity };
}

export const isCelebrity = (g: Graph, u: number, celebrityAt: number): boolean => g.followers[u].length >= celebrityAt;

export const isActive = (g: Graph, u: number, activeShare: number): boolean => g.activity[u] < activeShare;

/**
 * k-way 병합. 각 목록은 최신순으로 정렬돼 있어야 한다.
 * 목록 머리들 중 가장 최신 글을 고르고, 같은 id 는 한 번만 남긴다.
 */
export function mergeTimeline(lists: Post[][], size: number): Post[] {
  const cursor = lists.map(() => 0);
  const seen = new Set<number>();
  const out: Post[] = [];
  while (out.length < size) {
    let best = -1;
    for (let i = 0; i < lists.length; i++) {
      const head = lists[i][cursor[i]];
      if (head && (best < 0 || compareDesc(head, lists[best][cursor[best]]) < 0)) best = i;
    }
    if (best < 0) break;
    const post = lists[best][cursor[best]];
    cursor[best] += 1;
    if (!seen.has(post.id)) {
      seen.add(post.id);
      out.push(post);
    }
  }
  return out;
}

/** 글 한 건을 쓸 때 타임라인에 넣는 항목 수 */
export function fanoutWrites(g: Graph, author: number, strategy: Strategy, p: Params): number {
  if (strategy === 'pull') return 0;
  if (strategy === 'hybrid' && isCelebrity(g, author, p.celebrityAt)) return 0;
  return g.followers[author].filter((f) => isActive(g, f, p.activeShare)).length;
}

export function loadTimeline(g: Graph, reader: number, strategy: Strategy, p: Params): Load {
  const followees = g.followees[reader];
  const pullAll = (rebuilt: boolean): Load => ({
    queries: followees.length,
    rebuilt,
    shown: mergeTimeline(
      followees.map((f) => g.recent[f]),
      PAGE_SIZE,
    ),
  });

  if (strategy === 'pull') return pullAll(false);
  if (!isActive(g, reader, p.activeShare)) return pullAll(true);

  const pushed = strategy === 'push' ? followees : followees.filter((f) => !isCelebrity(g, f, p.celebrityAt));
  const pulled = followees.filter((f) => !pushed.includes(f));
  const inbox = mergeTimeline(
    pushed.map((f) => g.recent[f]),
    INBOX_CAP,
  );
  const shown = mergeTimeline([inbox, ...pulled.map((f) => g.recent[f])], PAGE_SIZE);
  return {
    queries: (pushed.length > 0 ? 2 : 0) + pulled.length,
    rebuilt: false,
    shown,
  };
}

/** 쓰기 워커가 글 한 건의 쓰기를 모두 끝내는 데 걸리는 초 (예시 계산) */
export const deliverySeconds = (writes: number, writeRate: number): number => writes / writeRate;

/** 초당 글 수 대비 쓰기 워커 사용률. 1 을 넘으면 쓰기가 밀려요 */
export const workerLoad = (writes: number, postsPerSec: number, writeRate: number): number =>
  (writes * postsPerSec) / writeRate;

export const normalAuthor = (g: Graph): number => Math.floor(g.count / 4);

export const busiestReader = (g: Graph): number =>
  g.followees.reduce((best, list, u) => (list.length > g.followees[best].length ? u : best), 0);
