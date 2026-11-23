import { COMMENT_TABLE_ROWS, ROW_COST_MS, runLab, type LabConfig } from './model';

const base: LabConfig = { strategy: 'n-plus-one', listSize: 10, latencyMs: 5, batchSize: 10, indexed: true };
const run = (patch: Partial<LabConfig>) => runLab({ ...base, ...patch });

describe('조회 방식별 쿼리 수', () => {
  it.each([1, 5, 10, 100])('N+1 은 목록 %i개에 1 + N 번 조회한다', (n) => {
    expect(run({ strategy: 'n-plus-one', listSize: n }).queries).toBe(1 + n);
  });

  it.each([1, 10, 100])('JOIN 은 목록 %i개여도 한 번 조회한다', (n) => {
    expect(run({ strategy: 'join', listSize: n }).queries).toBe(1);
  });

  it.each([
    [10, 3, 5],
    [10, 10, 2],
    [7, 7, 2],
    [100, 50, 3],
    [1, 50, 2],
    [100, 1, 101],
  ])('IN 묶음은 목록 %i개, 묶음 %i개일 때 1 + ceil(N/B) = %i 번 조회한다', (n, b, expected) => {
    expect(run({ strategy: 'in-batch', listSize: n, batchSize: b }).queries).toBe(expected);
  });

  it('로그 줄 수는 쿼리 수와 같다', () => {
    const result = run({ strategy: 'in-batch', listSize: 23, batchSize: 4 });
    expect(result.log).toHaveLength(result.queries);
  });
});

describe('예상 시간', () => {
  it('N+1 은 목록이 길어질수록 시간이 늘어난다', () => {
    const times = Array.from({ length: 100 }, (_, i) => run({ listSize: i + 1 }).estimatedMs);
    times.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(times[i]));
  });

  it('JOIN 과 N+1 의 차이는 추가 왕복 N번만큼이다', () => {
    const nPlusOne = run({ strategy: 'n-plus-one', listSize: 20, latencyMs: 8 });
    const join = run({ strategy: 'join', listSize: 20, latencyMs: 8 });
    expect(nPlusOne.estimatedMs - join.estimatedMs).toBeCloseTo(20 * 8, 6);
  });

  it('왕복 지연이 0이면 시간은 읽은 행 수에만 비례한다', () => {
    const slow = run({ strategy: 'join', listSize: 5, latencyMs: 0 });
    expect(slow.estimatedMs).toBeCloseTo(slow.rowsScanned * ROW_COST_MS, 9);
  });
});

describe('인덱스 사용 여부', () => {
  it.each(['n-plus-one', 'join', 'in-batch'] as const)('%s 는 인덱스가 없으면 더 많은 행을 읽는다', (strategy) => {
    const withIndex = run({ strategy, listSize: 30, indexed: true });
    const withoutIndex = run({ strategy, listSize: 30, indexed: false });
    expect(withoutIndex.rowsScanned).toBeGreaterThan(withIndex.rowsScanned);
  });

  it('인덱스가 없는 N+1 은 쿼리마다 댓글 테이블 전체를 읽는다', () => {
    const result = run({ strategy: 'n-plus-one', listSize: 4, indexed: false });
    const perComment = result.log.slice(1).map((item) => item.rowsScanned);
    expect(perComment).toEqual([COMMENT_TABLE_ROWS, COMMENT_TABLE_ROWS, COMMENT_TABLE_ROWS, COMMENT_TABLE_ROWS]);
  });
});
