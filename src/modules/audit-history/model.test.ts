import { describe, expect, it } from 'vitest';
import { type CaptureSite, type RecordMode, presetSteps, restoreAt, run, stepAt } from './model';

// 예시 순서: #0 처음 등록 1,000 · #1 1,200 편집 · #2 900 편집 · #3 삭제 · #4 복구 · #5 DB 직접 1,500
const steps = presetSteps();
const last = steps.length - 1;

const go = (mode: RecordMode, site: CaptureSite) => run(steps, mode, site);

describe('현재 값만 기록', () => {
  it('이력이 비고, 덮인 옛 값은 되돌릴 수 없어요', () => {
    const result = go('current', 'app');
    expect(result.history).toHaveLength(0);
    expect(restoreAt(result, steps, 'current', 2)).toEqual({ status: 'lost', value: null });
  });

  it('현재 값은 마지막 동작의 실제 값으로 남아요', () => {
    const result = go('current', 'app');
    expect(result.truth[last]).toEqual({ price: 1500, deleted: false });
    expect(restoreAt(result, steps, 'current', last)).toEqual({
      status: 'exact',
      value: { price: 1500, deleted: false },
    });
  });
});

describe('앱 코드 기록과 DB 직접 수정', () => {
  it('직접 수정은 이력에 없고, 그 시점 값은 틀린 값으로 복원돼요', () => {
    const result = go('event', 'app');
    expect(result.missed).toBe(1);
    expect(result.history.map((e) => e.kind)).toEqual(['create', 'edit', 'edit', 'delete', 'restore']);

    const restored = restoreAt(result, steps, 'event', last);
    expect(restored.status).toBe('stale');
    expect(restored.value).toEqual({ price: 900, deleted: false });
    expect(result.truth[last]).toEqual({ price: 1500, deleted: false });
  });

  it('직접 수정 이전 시점은 기록으로 맞출 수 있어요', () => {
    const result = go('snapshot', 'app');
    expect(restoreAt(result, steps, 'snapshot', 2)).toEqual({
      status: 'exact',
      value: { price: 900, deleted: false },
    });
  });
});

describe('DB 트리거 기록', () => {
  it('직접 수정도 이력에 남아 같은 시점 값이 맞게 복원돼요', () => {
    const result = go('event', 'trigger');
    expect(result.missed).toBe(0);
    expect(restoreAt(result, steps, 'event', last)).toEqual({
      status: 'exact',
      value: { price: 1500, deleted: false },
    });
  });
});

describe('이벤트 기록 필드', () => {
  it('행위자, 시각, 이전 값과 새 값, 요청 id 를 남겨요', () => {
    const result = go('event', 'app');
    const edit = result.history.find((e) => e.kind === 'edit' && e.after.price === 1200);
    expect(edit).toEqual({
      at: stepAt(1),
      actor: 'admin-17',
      kind: 'edit',
      before: { price: 1000, deleted: false },
      after: { price: 1200, deleted: false },
      requestId: 'req-1',
    });
  });

  it('처음 등록에는 이전 값이 없어요', () => {
    const create = go('event', 'app').history[0];
    expect(create.before).toBeUndefined();
  });

  it('시각은 UTC 오프셋 Z 가 붙은 문자열로 남아요', () => {
    for (const step of steps) expect(step.at.endsWith('Z')).toBe(true);
  });
});

describe('덧붙이기 전용 이력', () => {
  it('동작을 더해도 앞선 이력 줄은 바뀌지 않아요', () => {
    const shorter = run(steps.slice(0, 3), 'event', 'trigger').history;
    const longer = run(steps, 'event', 'trigger').history;
    expect(longer.slice(0, shorter.length)).toEqual(shorter);
  });
});
