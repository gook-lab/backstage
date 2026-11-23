/** check-then-write: 시작 때 본 값으로 판단하고 쓸 때는 다시 보지 않아요. guarded: 행 하나와 조건부 UPDATE 로 확인과 차감을 한 번에 해요. */
export type WriteMode = 'check-then-write' | 'guarded';
export const WRITE_MODES: readonly WriteMode[] = ['check-then-write', 'guarded'];
export const WRITE_MODE_LABEL: Record<WriteMode, string> = {
  'check-then-write': '확인 후 쓰기',
  guarded: '유일 제약 + 조건부 차감',
};

export type Scenario = 'two-tabs' | 'payment-fail' | 'expire' | 'burst';
export const SCENARIOS: readonly Scenario[] = ['two-tabs', 'payment-fail', 'expire', 'burst'];
export const SCENARIO_LABEL: Record<Scenario, string> = {
  'two-tabs': '한 사용자가 두 탭에서 동시에 사용',
  'payment-fail': '결제 실패로 쿠폰 해제',
  expire: '예약 만료 뒤 늦은 결제',
  burst: '남은 쿠폰에 10명이 동시에 요청',
};

/** ok: 결제 성공 · fail: 결제 실패 · late: 예약 만료 뒤에 결제 결과가 도착 */
export type Pay = 'ok' | 'fail' | 'late';
export const PAY_LABEL: Record<Pay, string> = {
  ok: '결제 성공',
  fail: '결제 실패',
  late: '늦은 결제',
};

export interface Request {
  readonly user: number;
  readonly tick: number;
  readonly pay: Pay;
}

export type Outcome = 'rejected-used' | 'rejected-soldout' | 'confirmed' | 'released' | 'expired' | 'confirm-failed';
export const OUTCOME_LABEL: Record<Outcome, string> = {
  'rejected-used': '거절 · 이미 사용',
  'rejected-soldout': '거절 · 수량 소진',
  confirmed: '확정',
  released: '해제 · 결제 실패',
  expired: '만료 · 해제',
  'confirm-failed': '확정 실패 · 환불 필요',
};

export interface Params {
  readonly mode: WriteMode;
  readonly scenario: Scenario;
  /** 쿠폰 총 수량 */
  readonly stock: number;
  /** 예약 보류 시간 (틱) */
  readonly ttl: number;
}

/** 결제 응답까지 걸리는 틱 수 */
export const PAY_TICKS = 2;
export const HORIZON = 16;

export interface RowResult {
  readonly user: number;
  readonly tick: number;
  readonly pay: Pay;
  readonly outcome: Outcome;
}

export interface Result {
  readonly rows: readonly RowResult[];
  /** 확정된 할인 횟수 */
  readonly confirmed: number;
  /** 총 수량에서 확정 건수를 뺀 값. 음수면 초과 */
  readonly remaining: number;
  /** 같은 사용자가 확정을 여러 번 받은 추가 건수 */
  readonly duplicateUsers: number;
  /** 예약 만료 뒤 결제가 도착해 확정하지 못한 건수 */
  readonly refundNeeded: number;
}

export function scenarioRequests(s: Scenario, ttl: number): Request[] {
  switch (s) {
    case 'two-tabs':
      return [
        { user: 1, tick: 0, pay: 'ok' },
        { user: 1, tick: 0, pay: 'ok' },
        { user: 2, tick: 3, pay: 'ok' },
      ];
    case 'payment-fail':
      return [
        { user: 1, tick: 0, pay: 'fail' },
        { user: 2, tick: 3, pay: 'ok' },
      ];
    case 'expire':
      return [
        { user: 1, tick: 0, pay: 'late' },
        { user: 2, tick: ttl + 1, pay: 'ok' },
      ];
    case 'burst':
      return Array.from({ length: 10 }, (_, i) => ({ user: i + 1, tick: 0, pay: 'ok' as const }));
  }
}

type SlotStatus = 'RESERVED' | 'CONFIRMED' | 'RELEASED';

/** 사용 기록 한 행. guarded 모드에서는 사용자당 한 행을 상태만 바꿔 다시 써요 */
interface Slot {
  user: number;
  req: number;
  status: SlotStatus;
  until: number;
}

/**
 * 틱 순서: 만료 정리 → 도착 요청 → 결제 응답.
 * check-then-write 모드는 틱 시작 때의 사용 기록만 보고, 같은 틱의 요청끼리는 서로 보지 못해요.
 * guarded 모드는 요청을 하나씩 처리하고, 앞선 요청의 결과를 바로 봐요.
 */
export function simulate(p: Params): Result {
  const reqs = scenarioRequests(p.scenario, p.ttl);
  const outcome: (Outcome | undefined)[] = reqs.map(() => undefined);
  const slots: Slot[] = [];
  const slotOfReq: (Slot | undefined)[] = reqs.map(() => undefined);
  const payAt: number[] = reqs.map(() => -1);

  const isActive = (s: Slot) => s.status !== 'RELEASED';

  for (let t = 0; t <= HORIZON; t++) {
    for (const s of slots) {
      if (s.status === 'RESERVED' && s.until <= t) {
        s.status = 'RELEASED';
        if (outcome[s.req] === undefined) outcome[s.req] = 'expired';
      }
    }

    const active0 = slots.filter(isActive);
    const usersAtStart = new Set(active0.map((s) => s.user));
    const remainingAtStart = p.stock - active0.length;

    reqs.forEach((r, i) => {
      if (r.tick !== t) return;
      if (p.mode === 'check-then-write') {
        if (usersAtStart.has(r.user)) {
          outcome[i] = 'rejected-used';
          return;
        }
        if (remainingAtStart <= 0) {
          outcome[i] = 'rejected-soldout';
          return;
        }
        const s: Slot = { user: r.user, req: i, status: 'RESERVED', until: t + p.ttl };
        slots.push(s);
        slotOfReq[i] = s;
      } else {
        const own = slots.find((s) => s.user === r.user);
        if (own && isActive(own)) {
          outcome[i] = 'rejected-used';
          return;
        }
        if (slots.filter(isActive).length >= p.stock) {
          outcome[i] = 'rejected-soldout';
          return;
        }
        const s = own ?? { user: r.user, req: i, status: 'RESERVED' as SlotStatus, until: 0 };
        s.req = i;
        s.status = 'RESERVED';
        s.until = t + p.ttl;
        if (!own) slots.push(s);
        slotOfReq[i] = s;
      }
      payAt[i] = r.pay === 'late' ? t + p.ttl + 1 : t + PAY_TICKS;
    });

    reqs.forEach((r, i) => {
      const s = slotOfReq[i];
      if (!s || payAt[i] !== t) return;
      const valid = s.req === i && s.status === 'RESERVED';
      if (r.pay === 'fail') {
        if (valid) {
          s.status = 'RELEASED';
          outcome[i] = 'released';
        }
        return;
      }
      if (valid) {
        s.status = 'CONFIRMED';
        outcome[i] = 'confirmed';
      } else {
        outcome[i] = 'confirm-failed';
      }
    });
  }

  const finalActive = slots.filter(isActive);
  const perUser = new Map<number, number>();
  for (const s of finalActive) perUser.set(s.user, (perUser.get(s.user) ?? 0) + 1);
  let duplicateUsers = 0;
  for (const n of perUser.values()) duplicateUsers += Math.max(0, n - 1);

  const rows: RowResult[] = reqs.map((r, i) => ({
    user: r.user,
    tick: r.tick,
    pay: r.pay,
    outcome: outcome[i] ?? 'expired',
  }));
  const confirmed = rows.filter((r) => r.outcome === 'confirmed').length;

  return {
    rows,
    confirmed,
    remaining: p.stock - confirmed,
    duplicateUsers,
    refundNeeded: rows.filter((r) => r.outcome === 'confirm-failed').length,
  };
}
