import { RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type CartInput,
  CURRENCIES,
  CURRENCY_LABEL,
  type Currency,
  computeCart,
  DIGITS,
  formatAmount,
  ORDER_LABEL,
  ORDERS,
  type Order,
  REPR_LABEL,
  REPRS,
  type Repr,
  ROUNDING_LABEL,
  ROUNDINGS,
  type Rounding,
  SAMPLE_PRICES,
} from './model';
import './Simulator.css';

const QTY_LABEL = ['줄 1', '줄 2', '줄 3'];

export default function Simulator() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rounding, setRounding] = useState<Rounding>('halfExpand');
  const [order, setOrder] = useState<Order>('line');
  const [repr, setRepr] = useState<Repr>('float');
  const [discountPct, setDiscountPct] = useState(10);
  const [taxPct, setTaxPct] = useState(0);
  const [qtys, setQtys] = useState<number[]>([1, 1, 1]);

  const digits = DIGITS[currency];
  const prices = SAMPLE_PRICES[currency];
  const input: CartInput = {
    digits,
    lines: prices.map((priceMinor, i) => ({ priceMinor, qty: qtys[i] })),
    discountPct,
    taxPct,
    rounding,
    order,
    repr,
  };

  const shown = computeCart(input);
  const exact = computeCart({ ...input, repr: 'minor' });
  const otherOrder: Order = order === 'line' ? 'total' : 'line';
  const other = computeCart({ ...input, repr: 'minor', order: otherOrder });
  const diff = shown.total - exact.total;
  const orderDiff = exact.total - other.total;

  const setQty = (i: number, value: number) => setQtys((prev) => prev.map((q, j) => (j === i ? value : q)));

  return (
    <div className="ma-lab">
      <p className="ma-lab__hint">금액과 비율은 모두 예시예요. 실제 가격이나 세율과 관계없어요.</p>

      <RadioGroup
        label="통화"
        options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))}
        value={currency}
        onValueChange={setCurrency}
      />

      <RadioGroup
        label="반올림 방식"
        options={ROUNDINGS.map((r) => ({ value: r, label: ROUNDING_LABEL[r] }))}
        value={rounding}
        onValueChange={setRounding}
      />

      <RadioGroup
        label="계산 순서"
        options={ORDERS.map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
        value={order}
        onValueChange={setOrder}
      />

      <RadioGroup
        label="숫자 표현"
        options={REPRS.map((r) => ({ value: r, label: REPR_LABEL[r] }))}
        value={repr}
        onValueChange={setRepr}
      />

      <div className="ma-lab__controls">
        <label className="ma-field">
          <span>할인율 {discountPct}%</span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
          />
        </label>
        <label className="ma-field">
          <span>세율 {taxPct}% (예시)</span>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={taxPct}
            onChange={(e) => setTaxPct(Number(e.target.value))}
          />
        </label>
        {QTY_LABEL.map((name, i) => (
          <label className="ma-field" key={name}>
            <span>
              {name} 수량 {qtys[i]}개
            </span>
            <input
              type="range"
              min={1}
              max={9}
              step={1}
              value={qtys[i]}
              onChange={(e) => setQty(i, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <table className="ma-table">
        <caption>장바구니 줄 (단가는 예시)</caption>
        <thead>
          <tr>
            <th scope="col">줄</th>
            <th scope="col">단가</th>
            <th scope="col">수량</th>
            <th scope="col">줄 금액</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((priceMinor, i) => (
            <tr key={QTY_LABEL[i]}>
              <th scope="row">{QTY_LABEL[i]}</th>
              <td>{formatAmount(priceMinor, digits, currency)}</td>
              <td>{qtys[i]}</td>
              <td>{formatAmount(shown.lines[i].amount, digits, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ma-lab__results" aria-label="결과">
        <Stat label="선택한 방식의 합계" value={formatAmount(shown.total, digits, currency)} />
        <Stat label="정수 최소 단위 기준 합계" value={formatAmount(exact.total, digits, currency)} />
        <Stat label="차이" value={`${diff} 최소 단위`} tone={diff !== 0 ? 'accent' : 'ink'} />
        <Stat label="다른 계산 순서와 차이" value={`${orderDiff} 최소 단위`} />
      </section>

      {diff !== 0 && (
        <p className="ma-lab__alarm" role="status">
          숫자 표현 때문에 합계가 정수 기준과 {Math.abs(diff)} 최소 단위 달라요. 소수 계산 결과를 정수로 바꾸는 순간
          오차가 생겨요.
        </p>
      )}

      <p className="ma-lab__note">
        {order === 'line'
          ? '줄마다 반올림하면 줄 금액이 모두 정수예요. 합계는 줄 금액의 합이에요.'
          : '합계 뒤에 한 번만 반올림해요. 줄 금액은 반올림 전 값이라 소수가 남을 수 있어요.'}
      </p>
    </div>
  );
}
