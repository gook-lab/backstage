import { describe, expect, it } from 'vitest';
import { type CompFault, FAIL_OPTIONS, type FailAt, type Params, simulate } from './model';

const base: Params = {
  failAt: 'inventory',
  strategy: 'compensate',
  compFault: 'none',
  idempotent: true,
};

const FAILS = FAIL_OPTIONS.filter((f): f is Exclude<FailAt, 'none'> => f !== 'none');
const FAULTS: readonly CompFault[] = ['none', 'fail-once', 'fail-always', 'lost-reply'];

describe('성공 경로', () => {
  it('모든 단계가 끝나면 주문이 완료되고 서비스 상태가 모두 맞아요', () => {
    const r = simulate({ ...base, failAt: 'none', strategy: 'none' });
    expect(r.final.order).toBe('confirmed');
    expect(r.consistent).toBe(true);
    expect(r.events).toHaveLength(4);
  });
});

describe('보상 없음', () => {
  it('재고가 부족하면 결제는 남고 주문은 처리 중에 멈춰요', () => {
    const r = simulate({ ...base, strategy: 'none' });
    expect(r.money).toBe(1);
    expect(r.issues).toContain('주문이 처리 중에 멈췄어요');
    expect(r.consistent).toBe(false);
  });

  it('처리 중으로 보이는 시간은 끝날 때까지 이어져요', () => {
    const r = simulate({ ...base, strategy: 'none' });
    expect(r.pendingTicks).toBe(r.events.length);
  });
});

describe('보상 있음', () => {
  it('실패한 단계 앞에서 끝난 단계만 역순으로 되돌려 일관되게 끝나요', () => {
    for (const failAt of FAILS) {
      const r = simulate({ ...base, failAt, strategy: 'compensate' });
      expect(r.consistent).toBe(true);
      expect(r.money).toBe(0);
      expect(r.stock).toBe(0);
      expect(r.final.order).toBe('canceled');
    }
  });

  it('보상 한 번이 실패하면 거기서 멈춰 결제가 남고 주문은 처리 중이에요', () => {
    const r = simulate({ ...base, compFault: 'fail-once', strategy: 'compensate' });
    expect(r.stuckAt).toBe('payment');
    expect(r.money).toBe(1);
    expect(r.issues).toContain('주문이 처리 중에 멈췄어요');
  });
});

describe('보상 + 재시도', () => {
  it('보상이 한 번 실패해도 재시도로 회복해 일관되게 끝나요', () => {
    for (const failAt of FAILS) {
      const r = simulate({ ...base, failAt, compFault: 'fail-once', strategy: 'compensate-retry' });
      expect(r.consistent).toBe(true);
      expect(r.stuckAt).toBeNull();
    }
  });

  it('보상이 계속 실패하면 최대 시도 횟수만큼 보고 포기해요', () => {
    const r = simulate({ ...base, compFault: 'fail-always', strategy: 'compensate-retry' });
    const compEvents = r.events.filter((e) => e.phase === 'compensate');
    expect(compEvents).toHaveLength(3);
    expect(r.stuckAt).toBe('payment');
    expect(r.consistent).toBe(false);
  });

  it('응답만 유실된 보상을 멱등하게 재시도하면 효과는 한 번만 나요', () => {
    const r = simulate({ ...base, compFault: 'lost-reply', strategy: 'compensate-retry', idempotent: true });
    expect(r.consistent).toBe(true);
    expect(r.final.refunds).toBe(1);
  });

  it('응답 유실 뒤 멱등하지 않게 재시도하면 환불이 두 번 나가요', () => {
    const r = simulate({ ...base, compFault: 'lost-reply', strategy: 'compensate-retry', idempotent: false });
    expect(r.money).toBe(-1);
    expect(r.issues).toContain('환불이 결제보다 많이 나갔어요 (중복 환불)');
    expect(r.events.some((e) => e.duplicate)).toBe(true);
  });
});

describe('구매 결과 합계', () => {
  it('어떤 조합에서도 이벤트 순서가 틱 순서와 같고 실패 뒤 순방향 단계는 실행되지 않아요', () => {
    for (const failAt of FAILS) {
      for (const strategy of ['none', 'compensate', 'compensate-retry'] as const) {
        for (const compFault of FAULTS) {
          for (const idempotent of [true, false]) {
            const r = simulate({ failAt, strategy, compFault, idempotent });
            r.events.forEach((e, i) => expect(e.tick).toBe(i));
            const fwd = r.events.filter((e) => e.phase === 'forward');
            expect(fwd.at(-1)?.step).toBe(failAt);
            expect(fwd.at(-1)?.effect).toBe(false);
          }
        }
      }
    }
  });
});
