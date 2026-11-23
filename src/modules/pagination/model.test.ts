import {
  type LabState,
  type Post,
  decodeCursor,
  deletePost,
  encodeCursor,
  initialLab,
  isDone,
  judge,
  labReducer,
  readKeyset,
  readOffset,
  seedDb,
} from './model';

const ids = (posts: Post[]) => posts.map((p) => p.id);
const loadOnce = (s: LabState) => labReducer(s, { type: 'load' });

describe('읽기 방식', () => {
  it('offset 은 건너뛴 행 수만큼 버린다', () => {
    const posts = seedDb().posts;
    expect(ids(readOffset(posts, 1).items)).toEqual([12, 11, 10, 9, 8]);
    expect(readOffset(posts, 1).discarded).toBe(0);
    expect(ids(readOffset(posts, 2).items)).toEqual([7, 6, 5, 4, 3]);
    expect(readOffset(posts, 2).discarded).toBe(5);
    expect(readOffset(posts, 1000).discarded).toBe(4995);
  });

  it('keyset 은 커서 다음부터 이어 읽고 버리는 행이 없다', () => {
    const posts = seedDb().posts;
    const first = readKeyset(posts, null).items;
    const token = encodeCursor(first[first.length - 1]);
    expect(ids(readKeyset(posts, token).items)).toEqual([7, 6, 5, 4, 3]);
    expect(readKeyset(posts, token).discarded).toBe(0);
  });

  it('커서 토큰은 되돌리면 같은 정렬 키가 된다', () => {
    const key = { createdAt: 42, id: 7 };
    expect(decodeCursor(encodeCursor(key))).toEqual(key);
  });

  it('동률을 id 로 나누지 않으면 같은 시각의 글을 건너뛴다', () => {
    const tied: Post[] = [
      { id: 5, createdAt: 10, title: 'a' },
      { id: 4, createdAt: 10, title: 'b' },
      { id: 3, createdAt: 10, title: 'c' },
      { id: 2, createdAt: 9, title: 'd' },
      { id: 1, createdAt: 8, title: 'e' },
    ];
    const first = readKeyset(tied, null, 2).items;
    const token = encodeCursor(first[first.length - 1]);
    expect(ids(readKeyset(tied, token, 2).items)).toEqual([3, 2]);

    const naive = tied.filter((p) => p.createdAt < first[first.length - 1].createdAt).slice(0, 2);
    expect(ids(naive)).toEqual([2, 1]);
  });
});

describe('판정 — 중복 · 누락 · 지워짐', () => {
  it('첫 페이지만 본 직후에는 아무 문제가 없다', () => {
    const s = loadOnce(initialLab());
    expect(judge(s.offset, s.snapshot, s.db.posts)).toEqual({ duplicates: [], missing: [], gone: [] });
  });

  it('새 글이 위에 들어오면 offset 은 같은 글을 두 번 보여 준다', () => {
    let s = loadOnce(initialLab());
    s = labReducer(s, { type: 'insert', count: 3 });
    s = loadOnce(s);
    const off = judge(s.offset, s.snapshot, s.db.posts);
    expect(ids(s.offset[1])).toEqual([10, 9, 8, 7, 6]);
    expect(off.duplicates).toEqual([10, 9, 8]);
    expect(off.missing).toEqual([]);
  });

  it('1페이지의 글을 지우면 offset 은 다음 글을 건너뛴다', () => {
    let s = loadOnce(initialLab());
    s = labReducer(s, { type: 'deleteSecond' });
    expect(s.last).toContain('11번');
    s = loadOnce(s);
    const off = judge(s.offset, s.snapshot, s.db.posts);
    expect(ids(s.offset[1])).toEqual([6, 5, 4, 3, 2]);
    expect(off.duplicates).toEqual([]);
    expect(off.missing.map((p) => p.id)).toEqual([7]);
    expect(off.gone).toEqual([11]);
  });

  it('같은 두 사건에서 keyset 은 중복도 누락도 없다', () => {
    let s = loadOnce(initialLab());
    s = labReducer(s, { type: 'insert', count: 3 });
    s = labReducer(s, { type: 'deleteSecond' });
    s = loadOnce(s);
    const key = judge(s.keyset, s.snapshot, s.db.posts);
    expect(ids(s.keyset[1])).toEqual([7, 6, 5, 4, 3]);
    expect(key.duplicates).toEqual([]);
    expect(key.missing).toEqual([]);
    expect(key.gone).toEqual([11]);
  });
});

describe('keyset 불변식', () => {
  it('삽입과 삭제가 섞여도 중복 · 누락이 생기지 않는다', () => {
    for (const seed of [1, 7, 42, 2026]) {
      let rng = seed;
      const next = (n: number) => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng % n;
      };
      let s = initialLab();
      for (let step = 0; step < 200; step++) {
        const roll = next(10);
        if (roll < 3) s = labReducer(s, { type: 'insert', count: 1 + next(3) });
        else if (roll < 5) {
          const alive = s.db.posts;
          if (alive.length > 0) {
            const victim = alive[next(alive.length)];
            s = { ...s, db: deletePost(s.db, victim.id) };
          }
        } else {
          s = loadOnce(s);
        }
        const key = judge(s.keyset, s.snapshot, s.db.posts);
        expect(key.duplicates).toEqual([]);
        expect(key.missing).toEqual([]);
      }
    }
  });
});

describe('상태 전이', () => {
  it('마지막 페이지를 받으면 끝났다고 표시한다', () => {
    let s = initialLab();
    s = loadOnce(s);
    s = loadOnce(s);
    s = loadOnce(s);
    expect(s.offset.map((p) => p.length)).toEqual([5, 5, 2]);
    expect(isDone(s.offset)).toBe(true);
    expect(loadOnce(s)).toBe(s);
  });

  it('1페이지 전에 지우면 목록 두 번째 글을 지운다', () => {
    const s = labReducer(initialLab(), { type: 'deleteSecond' });
    expect(s.db.posts.some((p) => p.id === 11)).toBe(false);
  });

  it('처음부터 다시 누르면 초기 상태로 돌아간다', () => {
    let s = loadOnce(initialLab());
    s = labReducer(s, { type: 'insert', count: 3 });
    expect(labReducer(s, { type: 'reset' })).toEqual(initialLab());
  });
});
