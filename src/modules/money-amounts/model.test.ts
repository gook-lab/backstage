import { describe, expect, it } from 'vitest';
import { type CartInput, computeCart, formatAmount, ORDERS, ROUNDINGS, type Rounding, roundDiv } from './model';

const one = (priceMinor: number, digits = 2): CartInput => ({
  digits,
  lines: [{ priceMinor, qty: 1 }],
  discountPct: 0,
  taxPct: 0,
  rounding: 'floor',
  order: 'line',
  repr: 'minor',
});

describe('정수 나눗셈의 반올림', () => {
  it('0.5 가 걸린 값은 방식마다 다르게 정해져요', () => {
    expect(roundDiv(45n, 10n, 'halfExpand')).toBe(5n);
    expect(roundDiv(45n, 10n, 'halfEven')).toBe(4n);
    expect(roundDiv(45n, 10n, 'floor')).toBe(4n);
    expect(roundDiv(45n, 10n, 'ceil')).toBe(5n);
  });

  it('0.5 가 아닌 값은 반올림과 은행가 반올림이 같아요', () => {
    expect(roundDiv(35n, 10n, 'halfExpand')).toBe(roundDiv(35n, 10n, 'halfEven'));
    expect(roundDiv(37n, 10n, 'halfEven')).toBe(4n);
  });

  it('나누어떨어지면 어떤 방식이든 같은 값이에요', () => {
    for (const r of ROUNDINGS) expect(roundDiv(40n, 10n, r)).toBe(4n);
  });
});

describe('줄 금액 계산 — 정수 최소 단위', () => {
  it('할인 0.5 는 반올림에서 올리고 은행가 반올림에서 짝수 쪽으로 가요', () => {
    const tie = { ...one(5), discountPct: 10 };
    expect(computeCart({ ...tie, rounding: 'halfExpand' }).total).toBe(5);
    expect(computeCart({ ...tie, rounding: 'halfEven' }).total).toBe(4);
  });

  it('줄마다 반올림하면 세금 0.5 가 줄마다 올라가 합계가 1 커요', () => {
    const krw: CartInput = {
      digits: 0,
      lines: [
        { priceMinor: 5, qty: 1 },
        { priceMinor: 5, qty: 1 },
      ],
      discountPct: 0,
      taxPct: 10,
      rounding: 'halfExpand',
      order: 'line',
      repr: 'minor',
    };
    expect(computeCart(krw).total).toBe(12);
    expect(computeCart({ ...krw, order: 'total' }).total).toBe(11);
  });

  it('줄 금액은 정수이고 합계는 줄 금액의 합이에요', () => {
    for (const rounding of ROUNDINGS) {
      for (const discountPct of [0, 7, 15, 30]) {
        for (const taxPct of [0, 8, 10]) {
          const input: CartInput = {
            digits: 2,
            lines: [
              { priceMinor: 1999, qty: 3 },
              { priceMinor: 435, qty: 1 },
              { priceMinor: 725, qty: 7 },
            ],
            discountPct,
            taxPct,
            rounding,
            order: 'line',
            repr: 'minor',
          };
          const r = computeCart(input);
          for (const l of r.lines) expect(Number.isInteger(l.amount)).toBe(true);
          expect(r.total).toBe(r.lines.reduce((a, l) => a + l.amount, 0));
        }
      }
    }
  });

  it('합계 뒤 반올림은 줄 금액을 반올림 전 값으로 남기고 합계만 정수로 맞춰요', () => {
    const input: CartInput = { ...one(1999), discountPct: 15, order: 'total' };
    const r = computeCart(input);
    expect(r.lines[0].amount).toBeCloseTo(1699.15, 9);
    expect(Number.isInteger(r.lines[0].amount)).toBe(false);
    expect(Number.isInteger(r.total)).toBe(true);
  });
});

describe('소수 계산의 차이', () => {
  it('4.35 를 100 배 하면 434.99999999999994 가 되어 내림하면 1 센트가 모자라요', () => {
    expect(computeCart({ ...one(435), rounding: 'floor', repr: 'float' }).total).toBe(434);
    expect(computeCart({ ...one(435), rounding: 'floor', repr: 'minor' }).total).toBe(435);
  });

  it('줄 세 개를 내림하면 소수 계산 합계가 정수 계산보다 2 센트 적어요', () => {
    const input: CartInput = {
      digits: 2,
      lines: [
        { priceMinor: 1999, qty: 1 },
        { priceMinor: 435, qty: 1 },
        { priceMinor: 725, qty: 1 },
      ],
      discountPct: 0,
      taxPct: 0,
      rounding: 'floor',
      order: 'line',
      repr: 'minor',
    };
    expect(computeCart(input).total).toBe(3159);
    expect(computeCart({ ...input, repr: 'float' }).total).toBe(3157);
  });

  it('정수 최소 단위 계산은 모든 방식과 순서에서 정수 합계를 내요', () => {
    for (const rounding of ROUNDINGS as readonly Rounding[]) {
      for (const order of ORDERS) {
        const r = computeCart({ ...one(1999), discountPct: 15, taxPct: 10, rounding, order, repr: 'minor' });
        expect(Number.isInteger(r.total)).toBe(true);
      }
    }
  });
});

describe('금액 표시', () => {
  it('정수 최소 단위는 통화 형식으로 보이고, 소수가 남으면 그대로 보여 줘요', () => {
    expect(formatAmount(1699, 2, 'USD')).toContain('16.99');
    expect(formatAmount(12900, 0, 'KRW')).toContain('12,900');
    expect(formatAmount(1699.15, 2, 'USD')).toBe('1699.15 최소 단위 (소수가 남아요)');
  });
});
