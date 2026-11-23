export const PAGE_SIZE = 5;
const SEED_COUNT = 12;

export interface Post {
  id: number;
  createdAt: number;
  title: string;
}

/** 정렬 키 한 점. 커서는 이 값 하나를 가리킨다 */
export type Key = Pick<Post, 'createdAt' | 'id'>;

/** 항상 최신순(createdAt desc, id desc) 으로 들어 있다 */
export interface Db {
  posts: Post[];
  nextId: number;
}

export interface ReadResult {
  items: Post[];
  /** DB 가 읽고 버린 행 수 */
  discarded: number;
}

export interface Judgement {
  duplicates: number[];
  missing: Post[];
  gone: number[];
}

export interface LabState {
  db: Db;
  /** 첫 페이지를 읽은 순간의 글 목록. 중복 · 누락 판정의 기준이다 */
  snapshot: Post[] | null;
  offset: Post[][];
  keyset: Post[][];
  last: string;
}

export type LabAction =
  { type: 'load' } | { type: 'insert'; count: number } | { type: 'deleteSecond' } | { type: 'reset' };

const makePost = (id: number): Post => ({ id, createdAt: id, title: `글 ${id}` });

export function compareKey(a: Key, b: Key): number {
  return a.createdAt - b.createdAt || a.id - b.id;
}

export function seedDb(): Db {
  const posts = Array.from({ length: SEED_COUNT }, (_, i) => makePost(i + 1)).reverse();
  return { posts, nextId: SEED_COUNT + 1 };
}

export function insertPosts(db: Db, count: number): Db {
  const fresh = Array.from({ length: count }, (_, i) => makePost(db.nextId + i)).reverse();
  return { posts: [...fresh, ...db.posts], nextId: db.nextId + count };
}

export function deletePost(db: Db, id: number): Db {
  return { ...db, posts: db.posts.filter((p) => p.id !== id) };
}

export function encodeCursor(key: Key): string {
  return btoa(`${key.createdAt}:${key.id}`);
}

export function decodeCursor(token: string): Key {
  const [createdAt, id] = atob(token).split(':').map(Number);
  return { createdAt, id };
}

/** LIMIT · OFFSET. 건너뛸 행도 서버가 읽고 버린다 */
export function readOffset(posts: Post[], page: number, size = PAGE_SIZE): ReadResult {
  const offset = (page - 1) * size;
  return { items: posts.slice(offset, offset + size), discarded: offset };
}

/**
 * 커서 다음 size 개. 정렬 키 위치에서 바로 이어 읽는다고 가정하므로 버리는 행은 0 이다.
 * 동률 처리를 위해 createdAt 과 id 를 함께 비교한다.
 */
export function readKeyset(posts: Post[], token: string | null, size = PAGE_SIZE): ReadResult {
  const after = token === null ? null : decodeCursor(token);
  const items = posts.filter((p) => after === null || compareKey(p, after) < 0).slice(0, size);
  return { items, discarded: 0 };
}

export const isDone = (pages: Post[][]): boolean => pages.length > 0 && pages[pages.length - 1].length < PAGE_SIZE;

/** 지금까지 받은 마지막 글의 커서 토큰. 아직 아무것도 못 받았으면 null */
export function tokenOf(pages: Post[][]): string | null {
  for (let i = pages.length - 1; i >= 0; i--) {
    const last = pages[i][pages[i].length - 1];
    if (last) return encodeCursor(last);
  }
  return null;
}

/**
 * 받은 글을 기준 목록과 맞춰 본다.
 * 중복은 두 번 이상 받은 id, 누락은 기준 시점에 있었고 지금도 있으며 훑은 범위 안인데 받지 못한 글,
 * 지워짐은 받았지만 지금은 없는 글이다.
 */
export function judge(pages: Post[][], snapshot: Post[] | null, posts: Post[]): Judgement {
  const seen = pages.flat();
  const count = new Map<number, number>();
  for (const p of seen) count.set(p.id, (count.get(p.id) ?? 0) + 1);
  const alive = new Set(posts.map((p) => p.id));

  const lowest = seen.reduce<Key | null>((min, p) => (min === null || compareKey(p, min) < 0 ? p : min), null);
  const missing =
    lowest && snapshot ? snapshot.filter((p) => alive.has(p.id) && !count.has(p.id) && compareKey(p, lowest) > 0) : [];

  return {
    duplicates: [...count].filter(([, n]) => n > 1).map(([id]) => id),
    missing,
    gone: [...count.keys()].filter((id) => !alive.has(id)),
  };
}

export const initialLab = (): LabState => ({ db: seedDb(), snapshot: null, offset: [], keyset: [], last: '' });

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'load': {
      const offsetDone = isDone(state.offset);
      const keysetDone = isDone(state.keyset);
      if (offsetDone && keysetDone) return state;
      const offset = offsetDone
        ? state.offset
        : [...state.offset, readOffset(state.db.posts, state.offset.length + 1).items];
      const keyset = keysetDone
        ? state.keyset
        : [...state.keyset, readKeyset(state.db.posts, tokenOf(state.keyset)).items];
      return {
        ...state,
        snapshot: state.snapshot ?? state.db.posts,
        offset,
        keyset,
        last: '다음 페이지를 두 방식으로 불러왔어요.',
      };
    }
    case 'insert':
      return {
        ...state,
        db: insertPosts(state.db, action.count),
        last: `새 글 ${action.count}개가 맨 위에 들어왔어요.`,
      };
    case 'deleteSecond': {
      const firstPage = (state.offset[0] ?? []).filter((p) => state.db.posts.some((q) => q.id === p.id));
      const pool = firstPage.length > 0 ? firstPage : state.db.posts;
      const target = pool[1] ?? pool[0];
      if (!target) return state;
      return { ...state, db: deletePost(state.db, target.id), last: `서버에서 글 ${target.id}번이 삭제됐어요.` };
    }
    case 'reset':
      return initialLab();
  }
}
