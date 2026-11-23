import { describe, expect, it } from 'vitest';
import { type Params, run, runPoll, runSync } from './model';

const base: Params = { jobSeconds: 45, pollSeconds: 3, gatewaySeconds: 30 };

describe('동기 처리', () => {
  it('게이트웨이 제한 안에 끝나면 요청 한 번으로 결과를 봐요', () => {
    const r = runSync({ ...base, jobSeconds: 20 });
    expect(r.requests).toBe(1);
    expect(r.resultAt).toBe(20);
    expect(r.timedOut).toBe(false);
    expect(r.retryRisk).toBe(false);
  });

  it('작업이 제한보다 길면 504 로 끝나고 서버 작업은 계속 돌아요', () => {
    const r = runSync(base);
    expect(r.timedOut).toBe(true);
    expect(r.resultAt).toBeNull();
    expect(r.feDoneAt).toBe(30);
    expect(r.serverDoneAt).toBe(45);
  });

  it('504 뒤 다시 누르면 같은 작업이 한 번 더 돌 수 있다고 표시해요', () => {
    expect(runSync(base).retryRisk).toBe(true);
  });
});

describe('202 접수 + 폴링', () => {
  it('작업 45초를 3초 간격으로 조회하면 접수 1회와 조회 15회를 보내요', () => {
    const r = runPoll(base);
    expect(r.requests).toBe(16);
    expect(r.resultAt).toBe(45);
    expect(r.timedOut).toBe(false);
    expect(r.retryRisk).toBe(false);
  });

  it('간격이 작업 시간보다 길면 한 번 조회로 끝나고 결과는 간격 뒤에 봐요', () => {
    const r = runPoll({ jobSeconds: 20, pollSeconds: 30, gatewaySeconds: 30 });
    expect(r.requests).toBe(2);
    expect(r.resultAt).toBe(30);
  });

  it('간격 10초면 결과는 작업이 끝난 뒤 최대 간격만큼 늦게 보여요', () => {
    const r = runPoll({ ...base, pollSeconds: 10 });
    expect(r.resultAt).toBe(50);
    expect(r.serverDoneAt).toBe(45);
    expect(r.resultAt! - r.serverDoneAt).toBeLessThanOrEqual(10);
  });

  it('게이트웨이 제한을 넘는 긴 작업도 504 없이 결과를 받아요', () => {
    const r = runPoll({ jobSeconds: 180, pollSeconds: 5, gatewaySeconds: 30 });
    expect(r.timedOut).toBe(false);
    expect(r.resultAt).toBe(180);
  });

  it('조회 기록은 접수 뒤 진행 중을 거쳐 마지막에 succeeded 가 돼요', () => {
    const r = runPoll({ ...base, jobSeconds: 10, pollSeconds: 4 });
    expect(r.polls[0]).toEqual({ at: 0, status: 'queued' });
    expect(r.polls.map((p) => p.status)).toEqual(['queued', 'running', 'running', 'succeeded']);
  });
});

describe('run 진입점', () => {
  it('모드에 따라 맞는 계산을 골라요', () => {
    expect(run('sync', base).requests).toBe(1);
    expect(run('poll', base).requests).toBe(16);
  });

  it('범위를 벗어난 값은 허용 범위 안으로 맞춰요', () => {
    const r = runSync({ jobSeconds: 1, pollSeconds: 0, gatewaySeconds: 999 });
    expect(r.serverDoneAt).toBe(5);
    expect(runPoll({ jobSeconds: 5, pollSeconds: 0, gatewaySeconds: 30 }).requests).toBe(6);
  });
});
