/** 주문 한 건이 지나가는 단계. 순서가 곧 실행 순서예요 */
export type Step = 'order' | 'payment' | 'inventory' | 'shipping';
/** 보상 작업은 배송 요청 이전 단계만 되돌려요. 배송 요청은 마지막 단계라 되돌릴 일이 없어요 */
export type CompStep = Exclude<Step, 'shipping'>;
export type FailAt = 'none' | Exclude<Step, 'order'>;
export type Strategy = 'none' | 'compensate' | 'compensate-retry';
/** 보상 작업 하나의 첫 시도에 일어나는 일 */
export type CompFault = 'none' | 'fail-once' | 'fail-always' | 'lost-reply';
export type OrderStatus = 'pending' | 'confirmed' | 'canceled';
export type Phase = 'forward' | 'compensate';

export const MAX_ATTEMPTS = 3;

export const FORWARD: readonly Step[] = ['order', 'payment', 'inventory', 'shipping'];

export const STEP_LABEL: Record<Step, string> = {
  order: '주문 생성',
  payment: '결제 승인',
  inventory: '재고 차감',
  shipping: '배송 요청',
};

export const COMP_LABEL: Record<CompStep, string> = {
  order: '주문 취소',
  payment: '결제 취소 (환불)',
  inventory: '재고 복구',
};

export const FAIL_OPTIONS: readonly FailAt[] = ['none', 'payment', 'inventory', 'shipping'];
export const FAIL_LABEL: Record<FailAt, string> = {
  none: '실패 없음',
  payment: '결제 거절',
  inventory: '재고 부족',
  shipping: '배송 요청 실패',
};

export const STRATEGIES: readonly Strategy[] = ['none', 'compensate', 'compensate-retry'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  none: '보상 없음',
  compensate: '보상 있음',
  'compensate-retry': '보상 + 재시도',
};

export const COMP_FAULTS: readonly CompFault[] = ['none', 'fail-once', 'fail-always', 'lost-reply'];
export const COMP_FAULT_LABEL: Record<CompFault, string> = {
  none: '보상 정상',
  'fail-once': '첫 시도만 실패',
  'fail-always': '계속 실패',
  'lost-reply': '처리됐지만 응답 유실',
};

export interface Params {
  readonly failAt: FailAt;
  readonly strategy: Strategy;
  readonly compFault: CompFault;
  /** 보상 작업이 같은 요청을 두 번 받아도 효과를 한 번만 내는지 */
  readonly idempotent: boolean;
}

/** 각 서비스가 자기 DB 에 남긴 효과 */
export interface World {
  order: OrderStatus;
  paid: number;
  refunds: number;
  deducted: number;
  restores: number;
  requested: boolean;
}

export interface SagaEvent {
  readonly tick: number;
  readonly phase: Phase;
  readonly step: Step;
  readonly attempt: number;
  /** 이 시도로 서비스의 DB 상태가 바뀌었는지 */
  readonly effect: boolean;
  /** 호출한 쪽(오케스트레이터)이 성공으로 받았는지 */
  readonly reported: boolean;
  /** 이미 효과가 난 보상을 한 번 더 적용했는지 */
  readonly duplicate: boolean;
  /** 이 시도가 끝난 뒤 화면에 보이는 주문 상태 */
  readonly order: OrderStatus;
}

export interface Result {
  readonly events: readonly SagaEvent[];
  readonly final: Readonly<World>;
  /** 결제 승인 - 환불. 1 이면 돈이 나간 상태, 0 이면 없음, 음수면 환불이 더 많음 */
  readonly money: number;
  /** 재고 차감 - 복구. 1 이면 줄어 있음, 0 이면 정상, 음수면 복구가 더 많음 */
  readonly stock: number;
  readonly issues: readonly string[];
  readonly consistent: boolean;
  /** 보상이 포기되어 멈춘 단계. 없으면 보상이 끝났거나 보상이 필요 없었어요 */
  readonly stuckAt: CompStep | null;
  /** 화면에 주문이 처리 중으로 보이는 단계 수 */
  readonly pendingTicks: number;
}

function applyForward(w: World, step: Step): void {
  if (step === 'payment') w.paid += 1;
  if (step === 'inventory') w.deducted += 1;
  if (step === 'shipping') w.requested = true;
}

function applyComp(w: World, step: CompStep): void {
  if (step === 'payment') w.refunds += 1;
  if (step === 'inventory') w.restores += 1;
  if (step === 'order') w.order = 'canceled';
}

/** 보상 작업 한 번의 결과. 효과가 났는지와 호출자가 성공으로 받았는지를 따로 본다 */
function compAttempt(p: Params, attempt: number): { effect: boolean; reported: boolean } {
  switch (p.compFault) {
    case 'none':
      return { effect: true, reported: true };
    case 'fail-once':
      return attempt === 1 ? { effect: false, reported: false } : { effect: true, reported: true };
    case 'fail-always':
      return { effect: false, reported: false };
    case 'lost-reply':
      // 첫 시도는 효과가 나지만 응답이 유실돼요. 재시도는 멱등하면 건너뛰고, 아니면 한 번 더 적용해요.
      return attempt === 1 ? { effect: true, reported: false } : { effect: !p.idempotent, reported: true };
  }
}

/** 최종 상태에서 서비스끼리 어긋난 곳을 한 줄씩 적어요. 비어 있으면 일관돼요 */
export function diagnose(w: World): string[] {
  const money = w.paid - w.refunds;
  const stock = w.deducted - w.restores;
  const issues: string[] = [];
  if (w.order === 'pending') issues.push('주문이 처리 중에 멈췄어요');
  if (w.order === 'canceled' && money > 0) issues.push('주문은 취소됐는데 결제가 남아 있어요');
  if (w.order === 'canceled' && stock > 0) issues.push('주문은 취소됐는데 재고가 줄어 있어요');
  if (money < 0) issues.push('환불이 결제보다 많이 나갔어요 (중복 환불)');
  if (stock < 0) issues.push('재고가 실제보다 많이 늘었어요 (중복 복구)');
  return issues;
}

function summarize(w: World, events: SagaEvent[], stuckAt: CompStep | null): Result {
  const issues = diagnose(w);
  return {
    events,
    final: { ...w },
    money: w.paid - w.refunds,
    stock: w.deducted - w.restores,
    issues,
    consistent: issues.length === 0,
    stuckAt,
    pendingTicks: events.filter((e) => e.order === 'pending').length,
  };
}

/**
 * 순방향 단계를 차례로 실행하고, 실패하면 보상 전략에 따라 되돌려요.
 * 보상은 완료된 단계의 역순이고, 하나가 끝내 실패하면 거기서 멈춰요.
 * 같은 입력이면 항상 같은 결과가 나와요.
 */
export function simulate(p: Params): Result {
  const w: World = { order: 'pending', paid: 0, refunds: 0, deducted: 0, restores: 0, requested: false };
  const events: SagaEvent[] = [];
  let tick = 0;
  const push = (
    phase: Phase,
    step: Step,
    attempt: number,
    effect: boolean,
    reported: boolean,
    duplicate: boolean,
  ): void => {
    events.push({ tick: tick++, phase, step, attempt, effect, reported, duplicate, order: w.order });
  };

  let failed = false;
  for (const step of FORWARD) {
    if (step === p.failAt) {
      push('forward', step, 1, false, false, false);
      failed = true;
      break;
    }
    applyForward(w, step);
    push('forward', step, 1, true, true, false);
  }

  if (!failed) {
    w.order = 'confirmed';
    return summarize(w, events, null);
  }
  // 보상 없음 전략은 실패한 자리에서 멈춰요. 이미 낸 효과와 처리 중 주문이 그대로 남아요.
  if (p.strategy === 'none') return summarize(w, events, null);

  const attempts = p.strategy === 'compensate-retry' ? MAX_ATTEMPTS : 1;
  const comps: CompStep[] = [];
  if (w.deducted > 0) comps.push('inventory');
  if (w.paid > 0) comps.push('payment');
  comps.push('order');

  for (const c of comps) {
    let applied = false;
    let done = false;
    for (let a = 1; a <= attempts && !done; a++) {
      const r = compAttempt(p, a);
      const duplicate = r.effect && applied;
      if (r.effect) {
        applied = true;
        applyComp(w, c);
      }
      push('compensate', c, a, r.effect, r.reported, duplicate);
      done = r.reported;
    }
    if (!done) return summarize(w, events, c);
  }
  return summarize(w, events, null);
}
