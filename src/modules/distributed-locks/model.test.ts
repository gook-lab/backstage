import { describe, expect, it } from 'vitest';
import { MAX_TICK, type ScenarioId, scenarioById, simulate, type SimResult, type Strategy } from './model';

function run(strategy: Strategy, scenario: ScenarioId): SimResult {
  return simulate(strategy, scenarioById(scenario));
}

const eventsOf = (r: SimResult, workerId: string) => r.events.filter((e) => e.workerId === workerId);

describe('같은 입력은 같은 타임라인을 만든다', () => {
  it('두 번 돌려도 결과가 같다', () => {
    const a = run('redisFencing', 'pauseExpire');
    const b = run('redisFencing', 'pauseExpire');
    expect(b).toEqual(a);
  });

  it('프레임은 0부터 MAX_TICK까지 빠짐없이 있다', () => {
    const r = run('none', 'simultaneous');
    expect(r.frames.map((f) => f.tick)).toEqual(Array.from({ length: MAX_TICK + 1 }, (_, i) => i));
  });
});

describe('두 서버 동시 실행', () => {
  it('락이 없으면 두 서버가 모두 실행하고 두 번 저장돼요', () => {
    const r = run('none', 'simultaneous');
    expect(r.executions).toBe(2);
    expect(r.applied).toBe(2);
    expect(r.rejected).toBe(0);
  });

  it('프로세스 뮤텍스는 서버가 다르면 서로를 막지 못해요', () => {
    const r = run('processMutex', 'simultaneous');
    expect(r.executions).toBe(2);
    expect(r.applied).toBe(2);
  });

  it('Redis 락은 먼저 잡은 쪽만 실행하고, 나중 쪽은 SET NX 실패로 건너뛰어요', () => {
    const r = run('redisLock', 'simultaneous');
    expect(r.executions).toBe(1);
    expect(r.applied).toBe(1);
    expect(eventsOf(r, 'B1').map((e) => e.kind)).toEqual(['lockFail']);
  });

  it('DB 유일 제약은 두 번 실행을 막지 않고, 두 번째 저장만 거절해요', () => {
    const r = run('dbUnique', 'simultaneous');
    expect(r.executions).toBe(2);
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(1);
  });
});

describe('락 보유자 일시 정지 후 만료', () => {
  it('락 값 비교만 있으면 옛 보유자의 쓰기가 나중에 반영돼요', () => {
    const r = run('redisLock', 'pauseExpire');
    expect(r.executions).toBe(2);
    expect(r.applied).toBe(2);
    const aWrite = eventsOf(r, 'A1').find((e) => e.kind === 'applied');
    const bWrite = eventsOf(r, 'B1').find((e) => e.kind === 'applied');
    expect(aWrite && bWrite && aWrite.tick).toBeGreaterThan(bWrite?.tick ?? Infinity);
  });

  it('락이 만료된 것을 A1이 깨어나기 전에는 알 수 없다는 경고를 남겨요', () => {
    const r = run('redisLock', 'pauseExpire');
    const warn = eventsOf(r, 'A1').find((e) => e.kind === 'warn');
    expect(warn?.tick).toBe(3);
  });

  it('펜싱 토큰이 있으면 저장소가 옛 토큰 1의 쓰기를 거절해요', () => {
    const r = run('redisFencing', 'pauseExpire');
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(1);
    expect(eventsOf(r, 'A1').find((e) => e.kind === 'rejected')?.text).toContain('토큰 1');
  });

  it('DB 유일 제약도 늦게 도착한 쓰기를 거절해요', () => {
    const r = run('dbUnique', 'pauseExpire');
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(1);
    expect(eventsOf(r, 'A1').at(-1)?.kind).toBe('rejected');
  });
});

describe('락 해제 시 남의 락 삭제', () => {
  it('해제를 DEL로 하면 A1이 B1의 락을 지우고, 그 틈에 A2가 실행돼요', () => {
    const r = run('redisNaive', 'releaseOther');
    expect(r.executions).toBe(3);
    expect(r.applied).toBe(3);
    const deletes = r.events.filter((e) => e.kind === 'warn' && e.text.includes('지워졌어요'));
    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes[0]?.workerId).toBe('A1');
  });

  it('값 비교로 해제하면 A1은 남의 락을 건드리지 않고, A2는 락 실패로 건너뛰어요', () => {
    const r = run('redisLock', 'releaseOther');
    expect(r.executions).toBe(2);
    expect(eventsOf(r, 'A1').find((e) => e.kind === 'release')?.text).toContain('건드리지 않았어요');
    expect(eventsOf(r, 'A2').map((e) => e.kind)).toEqual(['lockFail']);
  });

  it('값 비교 해제여도 A1의 쓰기는 락이 이미 만료된 뒤에 반영돼요', () => {
    const r = run('redisLock', 'releaseOther');
    expect(r.applied).toBe(2);
    expect(eventsOf(r, 'A1').find((e) => e.kind === 'applied')?.tick).toBe(3);
  });

  it('DB 유일 제약은 세 번 실행돼도 저장은 한 번만 돼요', () => {
    const r = run('dbUnique', 'releaseOther');
    expect(r.executions).toBe(3);
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(2);
  });
});
