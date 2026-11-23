import { type Params, formatRanges, simulate } from './model';

const base: Params = {
  method: 'ttl',
  hbSec: 15,
  ttlSec: 45,
  graceSec: 0,
  writeSec: 30,
  keyMode: 'per-connection',
  scenario: 'clean',
};

const run = (patch: Partial<Params>) => simulate({ ...base, ...patch });

describe('접속 상태 모델', () => {
  it('정상 종료는 종료 프레임 순간 서버가 오프라인으로 보고, 유예가 없으면 화면도 바로 꺼져요', () => {
    const r = run({ graceSec: 0 });
    expect(r.staleOnline).toBe(0);
    expect(r.falseOffline).toBe(0);
    expect(r.ticks[60].server).toBe(false);
    expect(r.ticks[60].display).toBe(false);
  });

  it('표시 유예를 주면 정상 종료 뒤에도 유예 시간만큼 온라인으로 남아요', () => {
    const r = run({ graceSec: 5 });
    expect(r.staleOnline).toBe(5);
    expect(formatRanges(r.staleRanges)).toBe('60~64초');
  });

  it('앱 강제 종료는 마지막 하트비트 + TTL 뒤에야 오프라인이 돼요', () => {
    // 마지막 하트비트는 45초, TTL 45초라 90초까지 키가 살아 있어요
    const r = run({ scenario: 'crash', graceSec: 0 });
    expect(r.ticks[89].server).toBe(true);
    expect(r.ticks[90].server).toBe(false);
    expect(r.staleOnline).toBe(30);
  });

  it('TTL을 짧게 잡으면 강제 종료를 더 빨리 알아요', () => {
    const r = run({ scenario: 'crash', hbSec: 5, ttlSec: 10, graceSec: 0 });
    expect(r.staleOnline).toBe(5);
  });

  it('종료 이벤트만 믿으면 강제 종료는 영원히 온라인으로 남아요', () => {
    const r = run({ method: 'event', scenario: 'crash', graceSec: 0 });
    expect(r.staleOnline).toBe(60);
  });

  it('TTL 안에 묻히는 5초 끊김은 화면에 오프라인으로 바뀌지 않아요', () => {
    const r = run({ scenario: 'blip', hbSec: 15, ttlSec: 45, graceSec: 0 });
    expect(r.staleOnline).toBe(5);
    expect(r.falseOffline).toBe(0);
    expect(r.flips).toBe(0);
  });

  it('하트비트 간격이 TTL보다 길면 정상 연결인데도 깜빡여요', () => {
    const r = run({ scenario: 'clean', hbSec: 30, ttlSec: 10, graceSec: 0 });
    expect(r.falseOffline).toBeGreaterThan(0);
    expect(r.flips).toBeGreaterThan(0);
  });

  it('기기마다 키를 두면 한 기기가 종료해도 다른 기기가 살아 있으면 온라인이에요', () => {
    const r = run({ scenario: 'second', keyMode: 'per-connection', graceSec: 0 });
    expect(r.falseOffline).toBe(0);
  });

  it('사용자당 키 하나를 쓰면 한 기기의 종료가 다른 기기 상태까지 지워요', () => {
    const r = run({ scenario: 'second', keyMode: 'per-user', graceSec: 0 });
    expect(r.falseOffline).toBe(5);
    expect(formatRanges(r.falseRanges)).toBe('60~64초');
  });

  it('마지막 접속 시각을 하트비트마다 쓰면 기록 쓰기가 많지만 오차는 작아요', () => {
    const every = run({ scenario: 'crash', writeSec: 0 });
    const periodic = run({ scenario: 'crash', writeSec: 30 });
    expect(every.writes).toBeGreaterThan(periodic.writes);
    expect(every.lastSeenError).toBeLessThan(periodic.lastSeenError);
  });
});
