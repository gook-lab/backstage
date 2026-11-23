import {
  type Graph,
  type Params,
  type Post,
  PAGE_SIZE,
  busiestReader,
  fanoutWrites,
  loadTimeline,
  makeGraph,
  mergeTimeline,
  normalAuthor,
} from './model';

const USERS = 120;
const base: Params = { users: USERS, seed: 7, celebrityAt: 40, activeShare: 1 };
const graph: Graph = makeGraph(USERS, 7);
const ids = (posts: Post[]) => posts.map((p) => p.id);
const CELEB = 0;
const NORMAL = normalAuthor(graph);

describe('쓰기 — 글 한 건이 타임라인에 넣는 항목', () => {
  it('push 는 팔로워 수만큼 쓴다', () => {
    expect(fanoutWrites(graph, NORMAL, 'push', base)).toBe(graph.followers[NORMAL].length);
    expect(fanoutWrites(graph, CELEB, 'push', base)).toBe(graph.followers[CELEB].length);
  });

  it('hybrid 는 유명 사용자의 글에 쓰기를 만들지 않는다', () => {
    expect(graph.followers[CELEB].length).toBeGreaterThanOrEqual(base.celebrityAt);
    expect(fanoutWrites(graph, CELEB, 'hybrid', base)).toBe(0);
  });

  it('hybrid 의 일반 사용자 쓰기는 push 를 넘지 않는다', () => {
    expect(fanoutWrites(graph, NORMAL, 'hybrid', base)).toBeLessThanOrEqual(fanoutWrites(graph, NORMAL, 'push', base));
    expect(fanoutWrites(graph, NORMAL, 'hybrid', base)).toBe(graph.followers[NORMAL].length);
  });

  it('pull 은 글을 쓸 때 아무것도 쓰지 않는다', () => {
    expect(fanoutWrites(graph, CELEB, 'pull', base)).toBe(0);
    expect(fanoutWrites(graph, NORMAL, 'pull', base)).toBe(0);
  });

  it('비활성 팔로워에게는 쓰지 않는다', () => {
    const half = { ...base, activeShare: 0.5 };
    const active = graph.followers[NORMAL].filter((f) => graph.activity[f] < 0.5).length;
    expect(fanoutWrites(graph, NORMAL, 'push', half)).toBe(active);
  });
});

describe('읽기 — 타임라인 한 번 열 때 드는 질의', () => {
  it('pull 은 팔로우한 사람 수만큼 질의한다', () => {
    const reader = busiestReader(graph);
    expect(loadTimeline(graph, reader, 'pull', base).queries).toBe(graph.followees[reader].length);
  });

  it('push 는 받은편지함 조회와 글 가져오기 두 번으로 끝난다', () => {
    const reader = busiestReader(graph);
    expect(loadTimeline(graph, reader, 'push', base).queries).toBe(2);
  });

  it('hybrid 는 유명 사용자 수만큼 더 당겨 읽는다', () => {
    const reader = busiestReader(graph);
    const celebs = graph.followees[reader].filter((f) => graph.followers[f].length >= base.celebrityAt).length;
    expect(loadTimeline(graph, reader, 'hybrid', base).queries).toBe(2 + celebs);
  });

  it('활성 사용자의 hybrid 타임라인은 pull 과 같은 앞쪽 글을 보여 준다', () => {
    const reader = busiestReader(graph);
    const pulled = loadTimeline(graph, reader, 'pull', base).shown;
    const hybrid = loadTimeline(graph, reader, 'hybrid', base).shown;
    expect(pulled).toHaveLength(PAGE_SIZE);
    expect(ids(hybrid)).toEqual(ids(pulled));
  });

  it('비활성 사용자는 push 대신 한 번 당겨 와요', () => {
    const reader = busiestReader(graph);
    const idle = { ...base, activeShare: 0 };
    const load = loadTimeline(graph, reader, 'push', idle);
    expect(load.rebuilt).toBe(true);
    expect(load.queries).toBe(graph.followees[reader].length);
  });
});

describe('병합 — 최신순 · 중복 제거', () => {
  it('여러 목록을 최신순으로 합치고 같은 글은 한 번만 남긴다', () => {
    const a: Post[] = [
      { id: 9, authorId: 1, createdAt: 50 },
      { id: 4, authorId: 1, createdAt: 30 },
      { id: 2, authorId: 1, createdAt: 10 },
    ];
    const b: Post[] = [
      { id: 8, authorId: 2, createdAt: 40 },
      { id: 4, authorId: 2, createdAt: 30 },
      { id: 1, authorId: 2, createdAt: 5 },
    ];
    const c: Post[] = [{ id: 7, authorId: 3, createdAt: 40 }];
    const merged = mergeTimeline([a, b, c], 10);
    expect(ids(merged)).toEqual([9, 8, 7, 4, 2, 1]);
    const times = merged.map((p) => p.createdAt);
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect(new Set(ids(merged)).size).toBe(merged.length);
  });

  it('요청한 개수만큼만 돌려준다', () => {
    const a: Post[] = [
      { id: 3, authorId: 1, createdAt: 3 },
      { id: 2, authorId: 1, createdAt: 2 },
      { id: 1, authorId: 1, createdAt: 1 },
    ];
    expect(ids(mergeTimeline([a], 2))).toEqual([3, 2]);
  });
});

describe('그래프 — 같은 시드면 같은 결과', () => {
  it('같은 시드는 같은 그래프를 만든다', () => {
    expect(makeGraph(USERS, 7)).toEqual(makeGraph(USERS, 7));
  });

  it('시드가 다르면 팔로워 구조가 달라진다', () => {
    expect(makeGraph(USERS, 8).followers).not.toEqual(graph.followers);
  });

  it('팔로워 수는 앞쪽 사용자일수록 많다', () => {
    expect(graph.followers[0].length).toBeGreaterThan(graph.followers[1].length);
    expect(graph.followers[1].length).toBeGreaterThan(graph.followers[USERS - 1].length);
  });
});
