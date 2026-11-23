import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  type Action,
  allowedActions,
  type Request,
  run,
  SCENARIOS,
  STATUSES,
  type Status,
  TRANSITIONS,
} from './model';

const scenario = (id: string) => {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`없는 시나리오: ${id}`);
  return found;
};

describe('허용 전이 표', () => {
  it('표의 모든 상태와 동작은 DB 값 목록 안에 있어요', () => {
    for (const t of TRANSITIONS) {
      expect(STATUSES).toContain(t.from);
      expect(STATUSES).toContain(t.to);
      expect(ACTIONS).toContain(t.action);
    }
  });

  it('취소 버튼은 배송 준비까지만 가능하고 배송 중부터는 서버가 내려 주지 않아요', () => {
    expect(allowedActions('preparing')).toContain('cancel');
    expect(allowedActions('shipping')).not.toContain('cancel');
    expect(allowedActions('delivered')).toEqual([]);
    expect(allowedActions('canceled')).toEqual([]);
  });
});

describe('시나리오별 관찰 결과', () => {
  it('배송 중 취소 요청은 화면에서만 막으면 200 으로 통과하고 잘못된 전이가 생겨요', () => {
    const r = run(scenario('cancel-while-shipping'), 'ui-only');
    expect(r.responses[0]).toMatchObject({ status: 200, ignored: false });
    expect(r.finalStatus).toBe('canceled');
    expect(r.wrongTransitions).toBe(1);
  });

  it('배송 중 취소 요청은 서버가 확인하거나 조건부로 쓰면 409 와 현재 상태 배송 중을 받아요', () => {
    for (const mode of ['check-then-write', 'conditional'] as const) {
      const r = run(scenario('cancel-while-shipping'), mode);
      expect(r.responses[0]).toMatchObject({ status: 409, current: 'shipping' });
      expect(r.finalStatus).toBe('shipping');
      expect(r.wrongTransitions).toBe(0);
    }
  });

  it('늦게 온 결제 완료 통지는 화면에서만 막으면 배송 준비를 결제 완료로 되돌려요', () => {
    const r = run(scenario('late-payment'), 'ui-only');
    expect(r.finalStatus).toBe('paid');
    expect(r.wrongTransitions).toBe(1);
  });

  it('늦게 온 결제 완료 통지는 규칙으로 걸러서 2xx 로 받고 상태를 그대로 둬요', () => {
    for (const mode of ['check-then-write', 'conditional'] as const) {
      const r = run(scenario('late-payment'), mode);
      expect(r.responses[0]).toMatchObject({ status: 200, ignored: true });
      expect(r.finalStatus).toBe('preparing');
      expect(r.wrongTransitions).toBe(0);
    }
  });

  it('취소와 출고가 동시에 오면 서버 확인 후 쓰기는 둘 다 200 을 주고 잘못된 전이가 생겨요', () => {
    const r = run(scenario('cancel-and-ship'), 'check-then-write');
    expect(r.responses.map((x) => x.status)).toEqual([200, 200]);
    expect(r.finalStatus).toBe('refund_pending');
    expect(r.wrongTransitions).toBe(1);
  });

  it('취소와 출고가 동시에 와도 조건부 UPDATE 는 먼저 온 출고만 통과시키고 취소는 409 를 받아요', () => {
    const r = run(scenario('cancel-and-ship'), 'conditional');
    expect(r.responses).toEqual([
      { requestId: 'ship', status: 200, ignored: false, current: 'shipping' },
      { requestId: 'cancel', status: 409, ignored: false, current: 'shipping' },
    ]);
    expect(r.finalStatus).toBe('shipping');
    expect(r.wrongTransitions).toBe(0);
  });

  it('취소 버튼을 두 번 누르면 서버 확인 후 쓰기는 환불 대기를 두 번 쓰고, 조건부 UPDATE 는 두 번째를 막아요', () => {
    const checked = run(scenario('double-cancel'), 'check-then-write');
    expect(checked.responses.map((x) => x.status)).toEqual([200, 200]);
    expect(checked.wrongTransitions).toBe(1);

    const conditional = run(scenario('double-cancel'), 'conditional');
    expect(conditional.responses.map((x) => x.status)).toEqual([200, 409]);
    expect(conditional.finalStatus).toBe('refund_pending');
    expect(conditional.wrongTransitions).toBe(0);
  });
});

describe('조건부 UPDATE', () => {
  it('모든 시작 상태와 동작 조합에서 잘못된 전이가 생기지 않아요', () => {
    for (const start of STATUSES as readonly Status[]) {
      for (const a of ACTIONS as readonly Action[]) {
        for (const b of ACTIONS as readonly Action[]) {
          const requests: Request[] = [
            { id: 'a', label: 'a', actor: 'customer', action: a, group: 0 },
            { id: 'b', label: 'b', actor: 'warehouse', action: b, group: 0 },
          ];
          const r = run({ id: 'x', label: 'x', start, requests }, 'conditional');
          expect(r.wrongTransitions).toBe(0);
        }
      }
    }
  });

  it('응답 본문의 현재 상태는 조건부 UPDATE 에서 마지막으로 저장된 상태와 같아요', () => {
    for (const s of SCENARIOS) {
      const r = run(s, 'conditional');
      expect(r.responses.at(-1)?.current).toBe(r.finalStatus);
    }
  });
});
