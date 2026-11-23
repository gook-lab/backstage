import { describe, expect, it } from 'vitest';
import { type Action, type Config, apply, badgeRows, badgeValue, createRun, trueUnread } from './model';

const cfg = (over: Partial<Config> = {}): Config => ({
  readMode: 'flag',
  countMode: 'count',
  counterWrite: 'checked',
  initial: 40,
  ...over,
});

const run = (c: Config, actions: readonly Action[] = []) => actions.reduce((r, a) => apply(r, a), createRun(c));

describe('알림함 모델 — 행마다 read_at', () => {
  it('모두 읽음은 안 읽은 행 수만큼 갱신하고, 배지는 0 이 된다', () => {
    const r = run(cfg(), ['arrive', 'arrive', 'read-all']);
    const last = r.log[r.log.length - 1];
    expect(last.touched).toBe(42);
    expect(badgeValue(r)).toBe(0);
    expect(last.diff).toBe(0);
  });

  it('두 탭이 같은 알림을 동시에 읽으면 첫 요청만 행을 갱신한다', () => {
    const r = run(cfg(), ['race-read']);
    expect(r.log[0].touched).toBe(1);
    expect(trueUnread(r)).toBe(39);
  });
});

describe('알림함 모델 — 읽음 커서', () => {
  it('모두 읽음은 커서 1행과 예외 행 삭제만 남는다', () => {
    const r = run(cfg({ readMode: 'cursor' }), ['read-one', 'read-all']);
    expect(r.log[1].touched).toBe(2);
    expect(r.exceptions).toEqual([]);
    expect(trueUnread(r)).toBe(0);
  });

  it('가운데가 아닌 맨 위 알림부터 읽으면 예외 행이 쌓이고, 오래된 쪽을 읽으면 커서가 따라잡는다', () => {
    const r = run(cfg({ readMode: 'cursor', initial: 3 }), ['read-one', 'read-one']);
    expect(r.exceptions).toEqual([3, 2]);
    expect(r.cursor).toBe(0);
    expect(trueUnread(r)).toBe(1);

    const done = apply(r, 'read-one');
    expect(done.log[2].touched).toBe(5);
    expect(done.cursor).toBe(3);
    expect(done.exceptions).toEqual([]);
    expect(trueUnread(done)).toBe(0);
  });

  it('커서 방식에서 배지를 그릴 때 읽는 행은 커서 뒤 범위만큼이다', () => {
    const before = run(cfg({ readMode: 'cursor' }), ['arrive']);
    expect(badgeRows(before)).toBe(41);
    const after = apply(before, 'read-all');
    expect(badgeRows(after)).toBe(0);
  });
});

describe('알림함 모델 — 카운터 칸', () => {
  it('두 탭이 동시에 읽고 무조건 -1 을 하면 칸이 실제보다 작아진다', () => {
    const r = run(cfg({ countMode: 'counter', counterWrite: 'blind' }), ['race-read']);
    expect(badgeValue(r)).toBe(38);
    expect(trueUnread(r)).toBe(39);
    expect(r.log[0].diff).toBe(-1);
  });

  it('영향받은 행 수를 확인하면 같은 상황에서도 칸이 맞는다', () => {
    const r = run(cfg({ countMode: 'counter', counterWrite: 'checked' }), ['race-read']);
    expect(r.log[0].diff).toBe(0);
    expect(r.log[0].touched).toBe(2);
  });

  it('재계산은 칸을 실제 안 읽은 수로 되돌린다', () => {
    const drifted = run(cfg({ countMode: 'counter', counterWrite: 'blind' }), ['race-read', 'recount']);
    expect(drifted.log[1].diff).toBe(0);
    expect(drifted.log[1].touched).toBe(1);
  });

  it('COUNT 방식은 동시 읽기 뒤에도 차이가 생기지 않는다', () => {
    const r = run(cfg({ countMode: 'count', counterWrite: 'blind' }), ['race-read', 'race-read']);
    expect(r.log.every((e) => e.diff === 0)).toBe(true);
  });
});
