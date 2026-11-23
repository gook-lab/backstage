export type Policy = 'cart' | 'checkout' | 'payment';
export type WriteMode = 'atomic' | 'naive';
export type Intent = 'pay' | 'abandon-cart' | 'abandon-checkout';
export type Outcome = 'sold' | 'sold-out-cart' | 'sold-out-checkout' | 'sold-out-pay' | 'abandoned';

export const POLICIES: readonly Policy[] = ['cart', 'checkout', 'payment'];
export const POLICY_LABEL: Record<Policy, string> = {
  cart: '장바구니에 담을 때 잡기',
  checkout: '결제를 시작할 때 잡기',
  payment: '결제가 확정될 때 차감',
};

export const MODES: readonly WriteMode[] = ['atomic', 'naive'];
export const MODE_LABEL: Record<WriteMode, string> = {
  atomic: '원자적 UPDATE',
  naive: '읽고 나서 쓰기',
};

export const PAY_TICKS = 2;
export const ARRIVAL_TICKS = 24;
export const CHECKOUT_DELAY_MAX = 6;
export const HORIZON = 60;

export interface Params {
  readonly policy: Policy;
  readonly mode: WriteMode;
  readonly stock: number;
  readonly shoppers: number;
  readonly ttl: number;
  /** 0 이상 1 이하 */
  readonly abandonRate: number;
  readonly seed: number;
}

export interface Shopper {
  readonly id: number;
  readonly add: number;
  readonly checkout: number;
  readonly intent: Intent;
}

export interface Hold {
  readonly owner: number;
  readonly expiresAt: number;
  readonly abandoned: boolean;
}

export interface Result {
  readonly shoppers: readonly Shopper[];
  readonly outcomes: readonly Outcome[];
  readonly counts: Readonly<Record<Outcome, number>>;
  readonly sold: number;
  readonly oversold: number;
  readonly soldOutSeen: number;
  readonly soldByTick: readonly number[];
  readonly heldByTick: readonly number[];
  readonly stuckByTick: readonly number[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildShoppers(p: Params): Shopper[] {
  const rnd = mulberry32(p.seed);
  const drawn = Array.from({ length: p.shoppers }, () => {
    const add = Math.floor(rnd() * ARRIVAL_TICKS);
    const delay = Math.floor(rnd() * (CHECKOUT_DELAY_MAX + 1));
    const leaves = rnd() < p.abandonRate;
    const leaveAt: Intent = rnd() < 0.5 ? 'abandon-cart' : 'abandon-checkout';
    return { add, checkout: add + delay, intent: leaves ? leaveAt : ('pay' as Intent) };
  });
  return drawn.sort((a, b) => a.add - b.add || a.checkout - b.checkout).map((s, id) => ({ id, ...s }));
}

const EMPTY_COUNTS: Record<Outcome, number> = {
  sold: 0,
  'sold-out-cart': 0,
  'sold-out-checkout': 0,
  'sold-out-pay': 0,
  abandoned: 0,
};

/**
 * 한 틱은 한 시점이에요. 같은 틱의 요청은 naive 모드에서 틱 시작 때 본 재고를 같이 봐요.
 * atomic 모드는 조건과 차감을 한 번에 확인하므로 매번 최신 재고를 봐요.
 */
export function simulate(p: Params): Result {
  const shoppers = buildShoppers(p);
  const outcome: (Outcome | undefined)[] = shoppers.map(() => undefined);
  const holds: Hold[] = [];
  const reserves = p.policy !== 'payment';
  let sold = 0;
  const soldByTick: number[] = [];
  const heldByTick: number[] = [];
  const stuckByTick: number[] = [];

  for (let t = 0; t <= HORIZON; t++) {
    for (let k = holds.length - 1; k >= 0; k--) {
      if (holds[k].expiresAt <= t) holds.splice(k, 1);
    }
    const viewAtStart = p.stock - sold - holds.length;
    const canTake = (): boolean => (p.mode === 'naive' ? viewAtStart : p.stock - sold - holds.length) > 0;
    const hold = (owner: number, abandoned: boolean) => holds.push({ owner, expiresAt: t + p.ttl, abandoned });

    shoppers.forEach((s, i) => {
      if (s.add === t && reserves && p.policy === 'cart') {
        if (canTake()) hold(s.id, s.intent !== 'pay');
        else outcome[i] = 'sold-out-cart';
      }
      if (outcome[i] === undefined && s.add === t && s.intent === 'abandon-cart') outcome[i] = 'abandoned';

      if (outcome[i] === undefined && s.checkout === t && p.policy === 'checkout') {
        if (canTake()) hold(s.id, s.intent !== 'pay');
        else outcome[i] = 'sold-out-checkout';
      }
      if (outcome[i] === undefined && s.checkout === t && s.intent === 'abandon-checkout') outcome[i] = 'abandoned';

      if (outcome[i] === undefined && s.intent === 'pay' && s.checkout + PAY_TICKS === t) {
        const own = reserves ? holds.findIndex((h) => h.owner === s.id) : -1;
        if (own >= 0) {
          holds.splice(own, 1);
          sold += 1;
          outcome[i] = 'sold';
        } else if (canTake()) {
          sold += 1;
          outcome[i] = 'sold';
        } else {
          outcome[i] = 'sold-out-pay';
        }
      }
    });

    soldByTick.push(sold);
    heldByTick.push(holds.length);
    stuckByTick.push(holds.filter((h) => h.abandoned).length);
  }

  const outcomes = outcome.map((o, i) => {
    if (o === undefined) throw new Error(`shopper ${shoppers[i].id} did not finish`);
    return o;
  });
  const counts = { ...EMPTY_COUNTS };
  for (const o of outcomes) counts[o] += 1;

  return {
    shoppers,
    outcomes,
    counts,
    sold,
    oversold: Math.max(0, sold - p.stock),
    soldOutSeen: counts['sold-out-cart'] + counts['sold-out-checkout'] + counts['sold-out-pay'],
    soldByTick,
    heldByTick,
    stuckByTick,
  };
}
