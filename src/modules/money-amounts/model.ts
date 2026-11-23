export type Currency = 'KRW' | 'USD' | 'KWD';
export type Rounding = 'halfExpand' | 'floor' | 'ceil' | 'halfEven';
export type Order = 'line' | 'total';
export type Repr = 'minor' | 'float';

export const CURRENCIES: readonly Currency[] = ['KRW', 'USD', 'KWD'];
export const CURRENCY_LABEL: Record<Currency, string> = {
  KRW: '원 (KRW · 소수 0자리)',
  USD: '달러 (USD · 소수 2자리)',
  KWD: '쿠웨이트 디나르 (KWD · 소수 3자리)',
};
/** 예시 단가. 최소 단위 정수예요 (원, 센트, 필스 단위) */
export const SAMPLE_PRICES: Record<Currency, readonly number[]> = {
  KRW: [12900, 4500, 7800],
  USD: [1999, 435, 725],
  KWD: [1250, 450, 7725],
};
export const DIGITS: Record<Currency, number> = { KRW: 0, USD: 2, KWD: 3 };

export const ROUNDINGS: readonly Rounding[] = ['halfExpand', 'floor', 'ceil', 'halfEven'];
export const ROUNDING_LABEL: Record<Rounding, string> = {
  halfExpand: '반올림 (0.5 는 올려요)',
  floor: '내림',
  ceil: '올림',
  halfEven: '은행가 반올림 (0.5 는 짝수 쪽)',
};

export const ORDERS: readonly Order[] = ['line', 'total'];
export const ORDER_LABEL: Record<Order, string> = {
  line: '줄마다 반올림',
  total: '합계 뒤에 한 번 반올림',
};

export const REPRS: readonly Repr[] = ['minor', 'float'];
export const REPR_LABEL: Record<Repr, string> = {
  minor: '정수 최소 단위 (BigInt)',
  float: 'JS Number 소수 계산',
};

export interface CartLine {
  /** 단가, 최소 단위 정수 */
  readonly priceMinor: number;
  readonly qty: number;
}

export interface CartInput {
  /** ISO 4217 기준 소수 자릿수 */
  readonly digits: number;
  readonly lines: readonly CartLine[];
  /** 0 이상 100 이하 정수 % */
  readonly discountPct: number;
  /** 0 이상 100 이하 정수 % */
  readonly taxPct: number;
  readonly rounding: Rounding;
  readonly order: Order;
  readonly repr: Repr;
}

export interface LineAmount {
  /** 할인 전 소계, 최소 단위 정수 */
  readonly subtotal: number;
  /**
   * 줄 금액, 최소 단위. 줄마다 반올림이면 정수예요.
   * 합계 뒤 반올림이면 반올림 전 값이라 소수가 남을 수 있어요.
   */
  readonly amount: number;
}

export interface CartResult {
  readonly lines: readonly LineAmount[];
  readonly total: number;
}

/** 0 이상인 정수 n / d (d > 0) 를 지정한 방식으로 정수로 바꿔요 */
export function roundDiv(n: bigint, d: bigint, rounding: Rounding): bigint {
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  if (rounding === 'floor') return q;
  if (rounding === 'ceil') return q + 1n;
  const twice = 2n * r;
  if (rounding === 'halfExpand') return twice >= d ? q + 1n : q;
  if (twice > d) return q + 1n;
  if (twice < d) return q;
  return q % 2n === 0n ? q : q + 1n;
}

function roundFloat(x: number, rounding: Rounding): number {
  if (rounding === 'floor') return Math.floor(x);
  if (rounding === 'ceil') return Math.ceil(x);
  if (rounding === 'halfExpand') return Math.round(x);
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function computeMinor(input: CartInput): CartResult {
  const disc = BigInt(input.discountPct);
  const tax = BigInt(input.taxPct);
  const subs = input.lines.map((l) => BigInt(l.priceMinor) * BigInt(l.qty));

  if (input.order === 'line') {
    const lines = subs.map((sub) => {
      const discounted = roundDiv(sub * (100n - disc), 100n, input.rounding);
      const taxAmount = roundDiv(discounted * tax, 100n, input.rounding);
      return { subtotal: Number(sub), amount: Number(discounted + taxAmount) };
    });
    return { lines, total: lines.reduce((acc, l) => acc + l.amount, 0) };
  }

  // 할인과 세율을 한 번에 곱해 분모 10000 으로 모은 뒤 합계에서 한 번만 반올림해요
  const scaled = subs.map((sub) => sub * (100n - disc) * (100n + tax));
  const sum = scaled.reduce((acc, v) => acc + v, 0n);
  return {
    lines: subs.map((sub, i) => ({ subtotal: Number(sub), amount: Number(scaled[i]) / 10000 })),
    total: Number(roundDiv(sum, 10000n, input.rounding)),
  };
}

function computeFloat(input: CartInput): CartResult {
  const scale = 10 ** input.digits;
  const d = input.discountPct / 100;
  const t = input.taxPct / 100;

  if (input.order === 'line') {
    const lines = input.lines.map((l) => {
      const sub = (l.priceMinor / scale) * l.qty;
      const discMinor = roundFloat(sub * (1 - d) * scale, input.rounding);
      const taxMinor = roundFloat((discMinor / scale) * t * scale, input.rounding);
      return { subtotal: l.priceMinor * l.qty, amount: discMinor + taxMinor };
    });
    return { lines, total: lines.reduce((acc, l) => acc + l.amount, 0) };
  }

  const raw = input.lines.map((l) => {
    const sub = (l.priceMinor / scale) * l.qty;
    return sub * (1 - d) * (1 + t) * scale;
  });
  const sum = raw.reduce((acc, v) => acc + v, 0);
  return {
    lines: input.lines.map((l, i) => ({ subtotal: l.priceMinor * l.qty, amount: raw[i] })),
    total: roundFloat(sum, input.rounding),
  };
}

export function computeCart(input: CartInput): CartResult {
  return input.repr === 'minor' ? computeMinor(input) : computeFloat(input);
}

/** 최소 단위 값을 통화 형식으로 보여 줘요. 소수가 남으면 숨기지 않고 그대로 보여 줘요 */
export function formatAmount(minor: number, digits: number, currency: Currency): string {
  if (!Number.isInteger(minor)) return `${minor} 최소 단위 (소수가 남아요)`;
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}
