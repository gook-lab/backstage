import { describe, expect, it } from 'vitest';
import {
  advance,
  createRun,
  getPreset,
  isDone,
  PRESETS,
  waitEdges,
  type PresetId,
  type RunState,
  type TxId,
} from './model';

function play(preset: PresetId, order: readonly TxId[]): RunState {
  return order.reduce((state, id) => advance(state, id), createRun(getPreset(preset)));
}

function playPreset(id: PresetId): RunState {
  return play(id, getPreset(id).schedule);
}

describe('프리셋 순서', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s 는 추천 순서로 끝까지 가면 두 트랜잭션이 모두 끝난다', (id) => {
    expect(isDone(playPreset(id))).toBe(true);
  });
});

describe('락 없이 읽고 쓰기 (갱신 손실)', () => {
  it('두 구매가 모두 커밋됐는데 재고는 1 이라서 한 번의 구매가 사라진다', () => {
    const state = playPreset('lost-update');
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('committed');
    expect(state.rows.stock.value).toBe(1);
  });

  it('B 는 A 가 쓴 락이 풀릴 때까지 쓰기에서 기다린다', () => {
    const state = play('lost-update', ['A', 'B', 'A', 'B']);
    expect(state.txs.B.status).toBe('waiting');
    expect(waitEdges(state)).toEqual([{ from: 'B', to: 'A', row: 'stock' }]);
  });
});

describe('FOR UPDATE (비관적 락)', () => {
  it('락을 먼저 잡고 읽으면 두 번의 구매가 모두 반영된다', () => {
    const state = playPreset('for-update');
    expect(state.rows.stock.value).toBe(0);
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('committed');
  });

  it('B 는 SELECT ... FOR UPDATE 에서 A 를 기다리고, 기다린 뒤 최신 값을 읽는다', () => {
    const waiting = play('for-update', ['A', 'B']);
    expect(waitEdges(waiting)).toEqual([{ from: 'B', to: 'A', row: 'stock' }]);
    const done = play('for-update', getPreset('for-update').schedule);
    expect(done.txs.B.snapshot.stock).toEqual({ value: 1, version: 1 });
  });
});

describe('버전 컬럼 (낙관적 락)', () => {
  it('A 만 커밋되고 B 는 version 이 바뀐 것을 알아채 409 로 충돌한다', () => {
    const state = playPreset('optimistic');
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('conflict');
    expect(state.rows.stock).toEqual({ value: 1, version: 1 });
  });
});

describe('원자적 UPDATE', () => {
  it('재고가 1 이면 한 명만 성공하고 다른 한 명은 거절당한다', () => {
    const state = playPreset('atomic-update');
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('rejected');
    expect(state.rows.stock.value).toBe(0);
  });

  it('재고가 2 면 두 명 모두 성공하고 재고는 0 이 된다', () => {
    const preset = getPreset('atomic-update');
    const rich = { ...preset, rows: { ...preset.rows, stock: { value: 2, version: 0 } } };
    const schedule: TxId[] = ['A', 'B', 'A', 'B', 'B'];
    const state = schedule.reduce(advance, createRun(rich));
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('committed');
    expect(state.rows.stock.value).toBe(0);
  });
});

describe('데드락', () => {
  it('대기 사슬이 순환을 이루는 순간에만 데드락으로 판정한다', () => {
    const beforeCycle = play('deadlock', ['A', 'B', 'A']);
    expect(beforeCycle.txs.A.outcome).toBeUndefined();
    expect(beforeCycle.txs.B.outcome).toBeUndefined();
    expect(waitEdges(beforeCycle)).toEqual([{ from: 'A', to: 'B', row: 'stock' }]);

    const atCycle = play('deadlock', ['A', 'B', 'A', 'B']);
    expect(atCycle.txs.B.status).toBe('aborted');
    expect(atCycle.txs.B.outcome).toBe('deadlock');
    expect(atCycle.txs.A.outcome).toBeUndefined();
  });

  it('누가 순환을 완성하든 나중에 시작한 B 를 희생자로 고른다', () => {
    const state = play('deadlock', ['B', 'A', 'B', 'A']);
    expect(state.txs.B.outcome).toBe('deadlock');
    expect(state.txs.A.outcome).toBeUndefined();
  });

  it('희생자의 변경은 버려지고 남은 트랜잭션만 커밋된다', () => {
    const state = playPreset('deadlock');
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('deadlock');
    expect(state.rows.order.value).toBe(1);
    expect(state.rows.stock.value).toBe(1);
  });

  it('두 트랜잭션이 같은 순서로 잠그면 데드락 없이 차례로 끝난다', () => {
    const preset = getPreset('deadlock');
    const sameOrder = { ...preset, scripts: { A: preset.scripts.A, B: preset.scripts.A } };
    const schedule: TxId[] = ['A', 'B', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B'];
    const state = schedule.reduce(advance, createRun(sameOrder));
    expect(isDone(state)).toBe(true);
    expect(state.txs.A.outcome).toBe('committed');
    expect(state.txs.B.outcome).toBe('committed');
  });
});
