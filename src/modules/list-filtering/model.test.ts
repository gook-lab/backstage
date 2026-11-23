import { describe, expect, it } from 'vitest';
import { countWork, facetWork, plan, type Query, TOTAL_ROWS } from './model';

const q = (over: Partial<Query> = {}): Query => ({
  status: 'all',
  period: 'all',
  sort: 'created',
  index: 'created',
  ...over,
});

describe('인덱스 사용과 정렬 단계', () => {
  it('인덱스가 없으면 전체 행을 읽고 정렬해요', () => {
    const p = plan(q({ index: 'none' }));
    expect(p.usesIndex).toBe(false);
    expect(p.tableRows).toBe(TOTAL_ROWS);
    expect(p.sortNeeded).toBe(true);
  });

  it('created_at 인덱스는 최신순 정렬을 대신해서 LIMIT 건만 읽어요', () => {
    const p = plan(q({ index: 'created' }));
    expect(p.usesIndex).toBe(true);
    expect(p.sortNeeded).toBe(false);
    expect(p.indexEntries).toBe(20);
    expect(p.tableRows).toBe(20);
  });

  it('드문 상태 필터는 같은 인덱스로 훨씬 많이 훑어야 해요', () => {
    const p = plan(q({ status: 'pending', period: '7d', index: 'created' }));
    expect(p.indexEntries).toBe(1000);
    expect(p.tableRows).toBe(1000);
    expect(p.sortNeeded).toBe(false);
  });

  it('(created_at, status) 는 상태를 인덱스 안에서 걸러 테이블 방문만 줄이고, 훑는 범위는 그대로예요', () => {
    const p = plan(q({ status: 'pending', period: '7d', index: 'created-status' }));
    expect(p.indexEntries).toBe(1000);
    expect(p.tableRows).toBe(20);
  });

  it('(status, created_at) 는 상태 등호가 있으면 정렬 없이 LIMIT 건에서 멈춰요', () => {
    const p = plan(q({ status: 'pending', period: '7d', index: 'status-created' }));
    expect(p.sortNeeded).toBe(false);
    expect(p.indexEntries).toBe(20);
  });

  it('(status, created_at) 는 상태 조건이 없으면 정렬 단계가 남아요', () => {
    const p = plan(q({ status: 'all', period: '7d', index: 'status-created' }));
    expect(p.sortNeeded).toBe(true);
    expect(p.sortRows).toBe(20000);
  });

  it('금액순 정렬은 금액 인덱스가 없으니 어떤 인덱스를 써도 정렬 단계가 남아요', () => {
    const p = plan(q({ sort: 'amount', index: 'created' }));
    expect(p.sortNeeded).toBe(true);
    expect(p.sortRows).toBe(TOTAL_ROWS);
  });
});

describe('부분 인덱스', () => {
  it('쿼리가 부분 인덱스 조건을 함의하면 인덱스 항목 수가 줄어요', () => {
    const partial = plan(q({ status: 'pending', index: 'partial-pending' }));
    const full = plan(q({ status: 'pending', index: 'created' }));
    expect(partial.usesIndex).toBe(true);
    expect(partial.indexSize).toBe(20000);
    expect(full.indexSize).toBe(TOTAL_ROWS);
  });

  it('쿼리 상태가 부분 인덱스 조건과 다르면 인덱스를 쓰지 않아요', () => {
    const p = plan(q({ status: 'shipping', index: 'partial-pending' }));
    expect(p.usesIndex).toBe(false);
  });
});

describe('개수 세기 방식', () => {
  it('정확한 COUNT 는 조건에 맞는 행을 모두 세요', () => {
    expect(countWork({ status: 'all', period: 'all' }, 'exact').rowsRead).toBe(TOTAL_ROWS);
  });

  it('상한 표시는 1001건까지만 세고 1,000건 이상이라고 보여 줘요', () => {
    const w = countWork({ status: 'all', period: 'all' }, 'cap');
    expect(w.rowsRead).toBe(1001);
    expect(w.shown).toBe('1,000건 이상');
  });

  it('다음 페이지 여부는 LIMIT + 1 건만 읽어요', () => {
    expect(countWork({ status: 'all', period: 'all' }, 'has-next').rowsRead).toBe(21);
    expect(countWork({ status: 'all', period: '7d' }, 'has-next').shown).toBe('다음 페이지 있음');
  });

  it('추정치는 행을 세지 않아요', () => {
    expect(countWork({ status: 'all', period: 'all' }, 'estimate').rowsRead).toBe(0);
  });
});

describe('facet 개수 비용', () => {
  it('상태 앞 열 인덱스가 있으면 값마다 자기 행만 읽어요', () => {
    const f = facetWork({ period: '7d', index: 'status-created' });
    expect(f.perValue.queries).toBe(3);
    expect(f.perValue.rowsRead).toBe(20000);
  });

  it('상태 앞 열 인덱스가 없으면 값마다 기간 행을 다시 훑어요', () => {
    const f = facetWork({ period: '7d', index: 'created' });
    expect(f.perValue.rowsRead).toBe(60000);
    expect(f.grouped.queries).toBe(1);
    expect(f.grouped.rowsRead).toBe(20000);
  });
});
