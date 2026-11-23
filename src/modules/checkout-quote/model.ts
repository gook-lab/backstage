/** 금액은 모두 정수(원)로 다뤄요. 견적은 장바구니에서 결제 화면으로 넘어올 때 한 번 저장돼요. */
export interface Pricing {
  readonly unitPrice: number;
  readonly quantity: number;
  readonly discount: number;
  readonly shipping: number;
}

export type Scenario = 'none' | 'price-up' | 'coupon-expired' | 'shipping-change';
export type Strategy = 'trust-client' | 'recompute' | 'quote-recompute';

export interface Change {
  readonly kind: 'price' | 'coupon' | 'shipping';
  readonly before: number;
  readonly after: number;
}

export type Reason = 'none' | 'changed' | 'expired';

export interface Settlement {
  /** 사용자가 화면에서 본 합계 */
  readonly quotedTotal: number;
  /** 서버가 지금 가격으로 다시 계산한 합계 */
  readonly serverTotal: number;
  /** 실제로 청구된 금액. 거절이면 0 */
  readonly charged: number;
  readonly rejected: boolean;
  readonly reason: Reason;
  /** 사용자에게 보여 준 변경 항목 */
  readonly shownChanges: readonly Change[];
}

/** 견적 유효 시간(분). 예시 값이에요 */
export const QUOTE_TTL_MIN = 10;
export const AGE_MAX_MIN = 15;

/** 장바구니 시점에 받은 견적 값. 예시 상품 한 종류를 두 개 담은 주문이에요 */
export const QUOTED: Pricing = { unitPrice: 12000, quantity: 2, discount: 3000, shipping: 3000 };

export const SCENARIOS: readonly Scenario[] = ['none', 'price-up', 'coupon-expired', 'shipping-change'];
export const SCENARIO_LABEL: Record<Scenario, string> = {
  none: '아무 일 없음',
  'price-up': '가격 인상',
  'coupon-expired': '쿠폰 만료',
  'shipping-change': '배송비 기준 변경',
};

export const STRATEGIES: readonly Strategy[] = ['trust-client', 'recompute', 'quote-recompute'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  'trust-client': '클라이언트 금액 신뢰',
  recompute: '서버 재계산만',
  'quote-recompute': '견적 id + 재계산',
};

export function total(p: Pricing): number {
  return p.unitPrice * p.quantity - p.discount + p.shipping;
}

/** 결제 직전 서버가 보는 현재 가격 상태 */
export function currentPricing(scenario: Scenario): Pricing {
  switch (scenario) {
    case 'price-up':
      return { ...QUOTED, unitPrice: 13000 };
    case 'coupon-expired':
      return { ...QUOTED, discount: 0 };
    case 'shipping-change':
      return { ...QUOTED, shipping: 5000 };
    case 'none':
      return QUOTED;
  }
}

export function diffPricing(quote: Pricing, current: Pricing): Change[] {
  const changes: Change[] = [];
  if (quote.unitPrice !== current.unitPrice) {
    changes.push({ kind: 'price', before: quote.unitPrice, after: current.unitPrice });
  }
  if (quote.discount !== current.discount) {
    changes.push({ kind: 'coupon', before: quote.discount, after: current.discount });
  }
  if (quote.shipping !== current.shipping) {
    changes.push({ kind: 'shipping', before: quote.shipping, after: current.shipping });
  }
  return changes;
}

export interface SettleInput {
  readonly scenario: Scenario;
  readonly strategy: Strategy;
  /** 사용자가 들고 있는 견적 */
  readonly quote?: Pricing;
  /** 견적을 받고 지난 시간(분) */
  readonly ageMin?: number;
}

export function settle({ scenario, strategy, quote = QUOTED, ageMin = 0 }: SettleInput): Settlement {
  const current = currentPricing(scenario);
  const changes = diffPricing(quote, current);
  const quotedTotal = total(quote);
  const serverTotal = total(current);

  if (strategy === 'trust-client') {
    // 요청에 담긴 금액을 그대로 청구해요. 서버는 금액을 계산하지 않아요.
    return { quotedTotal, serverTotal, charged: quotedTotal, rejected: false, reason: 'none', shownChanges: [] };
  }

  if (strategy === 'recompute') {
    // 서버는 현재 가격으로 청구하지만, 사용자에게는 바뀐 내용을 알리지 않아요.
    return { quotedTotal, serverTotal, charged: serverTotal, rejected: false, reason: 'none', shownChanges: [] };
  }

  if (ageMin > QUOTE_TTL_MIN) {
    return { quotedTotal, serverTotal, charged: 0, rejected: true, reason: 'expired', shownChanges: [] };
  }

  if (changes.length > 0) {
    return { quotedTotal, serverTotal, charged: 0, rejected: true, reason: 'changed', shownChanges: changes };
  }

  return { quotedTotal, serverTotal, charged: serverTotal, rejected: false, reason: 'none', shownChanges: [] };
}
