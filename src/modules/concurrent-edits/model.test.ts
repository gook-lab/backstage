import { describe, expect, it } from 'vitest';
import { ORDERS, type Order, type Params, STRATEGIES, type Strategy, simulate } from './model';

const base: Params = { strategy: 'none', order: 'a-first', requireIfMatch: false, omitIfMatchB: false };

function run(strategy: Strategy, order: Order, extra: Partial<Params> = {}) {
  return simulate({ ...base, strategy, order, ...extra });
}

describe('조건 없는 저장', () => {
  it('두 사람이 먼저 읽고 A가 먼저 저장하면 A의 수정이 B 저장에 덮여요', () => {
    const r = run('none', 'a-first');
    expect(r.saves.map((s) => s.status)).toEqual([200, 200]);
    expect(r.finalBody).toBe('B의 수정');
    expect(r.lost).toBe(1);
  });

  it('한 명씩 읽고 저장하면 두 번째 사람이 최신 값을 읽으므로 덮어쓰기가 없어요', () => {
    const r = run('none', 'seq');
    expect(r.saves.map((s) => s.status)).toEqual([200, 200]);
    expect(r.lost).toBe(0);
    expect(r.conflicts).toBe(0);
  });
});

describe('If-Match 조건부 저장', () => {
  it('먼저 저장한 쪽이 이기고 늦은 쪽은 412를 받아요', () => {
    const r = run('if-match', 'a-first');
    expect(r.saves.map((s) => [s.user, s.status])).toEqual([
      ['A', 200],
      ['B', 412],
    ]);
    expect(r.finalBody).toBe('A의 수정');
    expect(r.finalVersion).toBe(2);
    expect(r.lost).toBe(0);
  });

  it('B가 먼저 저장하면 A가 412를 받아요', () => {
    const r = run('if-match', 'b-first');
    expect(r.saves.find((s) => s.user === 'A')?.status).toBe(412);
    expect(r.finalBody).toBe('B의 수정');
  });

  it('If-Match 를 빠뜨린 저장은 설정에 따라 428로 거절되거나 조건 없이 덮어써요', () => {
    const rejected = run('if-match', 'b-first', { omitIfMatchB: true, requireIfMatch: true });
    expect(rejected.saves.find((s) => s.user === 'B')?.status).toBe(428);
    expect(rejected.finalBody).toBe('A의 수정');

    const overwritten = run('if-match', 'a-first', { omitIfMatchB: true, requireIfMatch: false });
    expect(overwritten.saves.find((s) => s.user === 'B')?.status).toBe(200);
    expect(overwritten.lost).toBe(1);
  });
});

describe('버전 칼럼 조건', () => {
  it('앞선 저장이 있으면 늦은 쪽의 UPDATE 가 0행이라 409를 받아요', () => {
    const r = run('version', 'a-first');
    expect(r.saves.map((s) => [s.user, s.status])).toEqual([
      ['A', 200],
      ['B', 409],
    ]);
    expect(r.finalBody).toBe('A의 수정');
    expect(r.finalVersion).toBe(2);
  });
});

describe('충돌 검사 불변식', () => {
  it.each(ORDERS)('조건을 쓰는 전략은 순서와 상관없이 덮어쓰기가 없어요 (%s)', (order) => {
    for (const strategy of ['if-match', 'version'] as const) {
      const r = run(strategy, order);
      expect(r.lost).toBe(0);
    }
  });

  it.each(STRATEGIES)('%s 전략에서 모든 저장은 응답 하나를 받아요', (strategy) => {
    for (const order of ORDERS) {
      const r = run(strategy, order);
      expect(r.saves).toHaveLength(2);
    }
  });
});
