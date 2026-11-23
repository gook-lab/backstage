/** 금액은 전부 정수(원)로 다뤄요. 소수가 생기는 나눗셈은 몫을 내림하고 끝수를 따로 배정해요. */

export type Allocation = 'ratio' | 'first' | 'none';
export const ALLOCATIONS: readonly Allocation[] = ['ratio', 'first', 'none'];
export const ALLOCATION_LABEL: Record<Allocation, string> = {
  ratio: '비율 배분',
  first: '첫 상품 몰아주기',
  none: '배분 없음',
};

export type Guard = 'none' | 'conditional' | 'idempotency' | 'both';
export const GUARDS: readonly Guard[] = ['none', 'conditional', 'idempotency', 'both'];
export const GUARD_LABEL: Record<Guard, string> = {
  none: '방어 없음',
  conditional: '조건부 갱신',
  idempotency: '멱등성 키',
  both: '둘 다 쓰기',
};

export interface Item {
  readonly name: string;
  /** 정수 원, 0 이상 */
  readonly price: number;
}

export interface ItemRefund {
  readonly name: string;
  readonly price: number;
  /** 이 상품에 배분된 주문 쿠폰 할인 (원) */
  readonly share: number;
  /** 이 상품만 취소할 때 돌려줄 금액 (원) */
  readonly refund: number;
}

export interface AllocationResult {
  readonly method: Allocation;
  readonly rows: readonly ItemRefund[];
  /** 상품 금액의 합 */
  readonly gross: number;
  /** 주문 쿠폰 할인 (상한을 넘으면 상품 합으로 잘라요) */
  readonly discount: number;
  /** 실제 결제액 = gross - discount */
  readonly paid: number;
  /** 비율 배분에서 끝수를 배정한 원 수 (예시 규칙으로 금액 큰 줄부터 1원씩) */
  readonly remainder: number;
  /** 비율 배분을 줄마다 반올림했을 때 합계가 할인액과 어긋난 원 수 (반올림만 한 경우) */
  readonly roundingGap: number;
  /** 모든 상품을 하나씩 취소했을 때 환불 합계 */
  readonly fullRefundSum: number;
  /** 전체 환불 합계가 결제액을 넘는 금액 */
  readonly overRefund: number;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function ratioShares(items: readonly Item[], discount: number, gross: number): { shares: number[]; remainder: number } {
  if (gross === 0) return { shares: items.map(() => 0), remainder: 0 };
  const shares = items.map((item) => Math.floor((discount * item.price) / gross));
  const remainder = discount - sum(shares);
  // 예시 규칙: 끝수는 금액이 큰 줄부터 1원씩 준다. 같은 금액이면 앞 줄부터.
  const order = items.map((_, idx) => idx).sort((a, b) => items[b].price - items[a].price || a - b);
  for (let k = 0; k < remainder; k += 1) {
    shares[order[k]] += 1;
  }
  return { shares, remainder };
}

function firstFillShares(items: readonly Item[], discount: number): number[] {
  let left = discount;
  return items.map((item) => {
    const take = Math.min(item.price, left);
    left -= take;
    return take;
  });
}

export function allocate(items: readonly Item[], orderDiscount: number, method: Allocation): AllocationResult {
  const gross = sum(items.map((i) => i.price));
  const discount = Math.min(Math.max(0, Math.trunc(orderDiscount)), gross);
  const paid = gross - discount;

  let shares: number[];
  let remainder = 0;
  if (method === 'ratio') {
    const r = ratioShares(items, discount, gross);
    shares = r.shares;
    remainder = r.remainder;
  } else if (method === 'first') {
    shares = firstFillShares(items, discount);
  } else {
    shares = items.map(() => 0);
  }

  const rows: ItemRefund[] = items.map((item, idx) => ({
    name: item.name,
    price: item.price,
    share: shares[idx],
    refund: item.price - shares[idx],
  }));

  const roundingGap =
    method === 'ratio' && gross > 0
      ? sum(items.map((item) => Math.round((discount * item.price) / gross))) - discount
      : 0;

  const fullRefundSum = sum(rows.map((r) => r.refund));
  return {
    method,
    rows,
    gross,
    discount,
    paid,
    remainder,
    roundingGap,
    fullRefundSum,
    overRefund: Math.max(0, fullRefundSum - paid),
  };
}

export interface RaceParams {
  /** 원 결제 금액 */
  readonly paid: number;
  /** 이미 환불된 합계 */
  readonly refunded: number;
  readonly amountA: number;
  readonly amountB: number;
  /** true 면 같은 요청(같은 키)을 두 번 보낸 경우 (더블 클릭 · 재시도) */
  readonly sameRequest: boolean;
  readonly guard: Guard;
}

export type StepOutcome = 'passed' | 'rejected' | 'deduped';

export interface RaceStep {
  readonly label: string;
  readonly amount: number;
  readonly outcome: StepOutcome;
  /** 이 요청이 끝난 뒤 누적 환불액 */
  readonly refundedAfter: number;
}

export interface RaceResult {
  readonly steps: readonly RaceStep[];
  /** 실제로 나간 누적 환불액 */
  readonly total: number;
  /** 환불 가능 잔액 = 결제액 - 이미 환불한 합계 (0 미만이면 0) */
  readonly available: number;
  /** 누적 환불액이 결제액을 넘는 금액 */
  readonly excess: number;
}

/**
 * 두 요청이 같은 순간에 들어온 상황을 순서대로 흉내 내요.
 * - 방어 없음 · 멱등성 키만: 두 요청 모두 처리 시작 전의 환불액(옛 값)을 읽고 판단해요.
 * - 조건부 갱신 · 둘 다: 앞 요청이 쓴 값을 보고 판단해요(WHERE 를 다시 평가하는 것과 같아요).
 * - 멱등성 키: 같은 키의 두 번째 요청은 새로 실행하지 않고 첫 결과를 돌려줘요.
 */
export function race(p: RaceParams): RaceResult {
  const keyed = p.guard === 'idempotency' || p.guard === 'both';
  const conditional = p.guard === 'conditional' || p.guard === 'both';
  const requests = [
    { label: '요청 A', amount: p.amountA },
    { label: p.sameRequest ? '요청 B (같은 요청 재전송)' : '요청 B', amount: p.sameRequest ? p.amountA : p.amountB },
  ];

  const snapshot = p.refunded;
  let current = p.refunded;
  const steps: RaceStep[] = [];

  requests.forEach((req, idx) => {
    if (keyed && p.sameRequest && idx === 1) {
      steps.push({ label: req.label, amount: req.amount, outcome: 'deduped', refundedAfter: current });
      return;
    }
    const base = conditional ? current : snapshot;
    const passed = base + req.amount <= p.paid;
    if (passed) current += req.amount;
    steps.push({
      label: req.label,
      amount: req.amount,
      outcome: passed ? 'passed' : 'rejected',
      refundedAfter: current,
    });
  });

  return {
    steps,
    total: current,
    available: Math.max(0, p.paid - p.refunded),
    excess: Math.max(0, current - p.paid),
  };
}
