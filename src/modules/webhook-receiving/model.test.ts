import { describe, expect, it } from 'vitest';
import { simulate, verdictOf, type Config } from './model';

const BASE: Config = {
  strategy: 'guard',
  payments: 100,
  returnLossPercent: 0,
  webhookLossPercent: 0,
  webhookDelayMax: 0,
  duplicatePercent: 0,
  reorderPercent: 0,
  reconEvery: 0,
  seed: 7,
};

const run = (patch: Partial<Config>) => simulate({ ...BASE, ...patch });

describe('브라우저 복귀만 믿기', () => {
  it('복귀 요청이 전부 유실되면 100건이 결제 대기에 머물러요', () => {
    const result = run({ strategy: 'return-only', returnLossPercent: 100 });
    expect(result.stillPending).toBe(100);
    expect(result.wrong).toBe(100);
  });

  it('복귀는 다 오지만 환불은 보지 못해서, 환불된 주문만 틀려요', () => {
    const result = run({ strategy: 'return-only' });
    expect(result.wrong).toBe(result.refunds);
    expect(result.refunds).toBeGreaterThan(0);
    expect(result.doubleProcessed).toBe(0);
  });
});

describe('웹훅만 받기 (중복 · 순서 무시)', () => {
  it('같은 웹훅이 두 번 오면 결제 완료 처리가 모든 주문에서 두 번 실행돼요', () => {
    const result = run({ strategy: 'webhook-only', duplicatePercent: 100 });
    expect(result.doubleProcessed).toBe(100);
    expect(result.wrong).toBe(0);
  });

  it('환불이 완료 웹훅보다 먼저 오면 덮어쓰기 때문에 마지막 상태가 틀려요', () => {
    const result = run({ strategy: 'webhook-only', reorderPercent: 100 });
    expect(result.wrong).toBe(result.refunds);
  });
});

describe('웹훅 + 이벤트 ID 중복 제거 + 상태 전이 검사', () => {
  it('중복 웹훅은 버려서 두 번 처리되는 주문이 없어요', () => {
    const result = run({ strategy: 'guard', duplicatePercent: 100 });
    expect(result.doubleProcessed).toBe(0);
    expect(result.wrong).toBe(0);
    expect(result.deduped).toBe(100 + result.refunds);
  });

  it('환불이 먼저 오면 전이 검사가 거절해서, 대사가 없으면 틀린 채로 남아요', () => {
    const result = run({ strategy: 'guard', reorderPercent: 100 });
    expect(result.rejected).toBe(result.refunds);
    expect(result.wrong).toBe(result.refunds);
  });

  it('승인 웹훅을 잃으면 주문이 결제 대기에 머물러요', () => {
    const result = run({ strategy: 'guard', webhookLossPercent: 100 });
    expect(result.stillPending).toBe(100);
  });
});

describe('주기적 대사 (PG 조회)', () => {
  it('웹훅이 전부 사라져도 대사가 PG 상태로 맞춰서 틀린 주문이 없어요', () => {
    const result = run({ strategy: 'guard-recon', webhookLossPercent: 100, reconEvery: 10 });
    expect(result.wrong).toBe(0);
    expect(result.stillPending).toBe(0);
    expect(result.doubleProcessed).toBe(0);
    expect(result.avgConfirmTicks).not.toBeNull();
  });

  it('웹훅이 뒤섞이고 중복되고 유실돼도 대사가 있으면 최종 상태는 맞아요', () => {
    const result = run({
      strategy: 'guard-recon',
      webhookLossPercent: 30,
      duplicatePercent: 50,
      reorderPercent: 100,
      webhookDelayMax: 5,
      reconEvery: 20,
    });
    expect(result.wrong).toBe(0);
    expect(result.doubleProcessed).toBe(0);
  });
});

describe('결정적 시드', () => {
  it('같은 설정이면 같은 결과와 같은 로그가 나와요', () => {
    const config: Config = { ...BASE, strategy: 'guard-recon', webhookDelayMax: 5, duplicatePercent: 30, seed: 42 };
    expect(simulate(config)).toEqual(simulate(config));
  });
});

describe('결과 문구', () => {
  it('틀린 주문이 있으면 오류 문구를 고르고, 없으면 성공 문구를 골라요', () => {
    expect(verdictOf(run({ strategy: 'return-only', returnLossPercent: 100 })).tone).toBe('error');
    expect(verdictOf(run({ strategy: 'guard-recon', webhookLossPercent: 100, reconEvery: 10 })).tone).toBe('success');
  });
});
