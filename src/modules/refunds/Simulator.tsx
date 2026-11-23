import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ALLOCATION_LABEL,
  ALLOCATIONS,
  type Allocation,
  allocate,
  GUARD_LABEL,
  GUARDS,
  type Guard,
  type Item,
  race,
} from './model';
import './Simulator.css';

const ITEM_NAMES = ['원두 A', '원두 B', '드립백'] as const;
const RACE_PAID = 30000;

type RequestKind = 'distinct' | 'same';

const ALLOCATION_HINT: Record<Allocation, string> = {
  ratio: '상품 금액 비율대로 할인을 나눠요. 몫은 내림하고, 남은 끝수는 금액이 큰 줄부터 1원씩 줘요. (예시 규칙)',
  first: '할인을 첫 상품부터 채워요. 첫 상품이 할인보다 작으면 다음 상품으로 넘겨요.',
  none: '할인을 줄에 나누지 않아요. 상품 환불은 정가로 나가서 전체 환불이 결제액을 넘을 수 있어요.',
};

const GUARD_HINT: Record<Guard, string> = {
  none: '두 요청이 같은 옛 환불액을 읽고 둘 다 한도 안이라고 판단해요.',
  conditional: '환불 한도를 WHERE 조건에 넣어요. 앞 요청이 쓴 값을 보고 두 번째 요청이 걸러져요.',
  idempotency: '같은 키의 두 번째 요청은 첫 결과를 돌려받아요. 서로 다른 두 건은 걸러내지 못해요.',
  both: '같은 요청은 키로 한 번만 실행하고, 서로 다른 요청은 조건부 갱신으로 한도 안에서만 통과시켜요.',
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const OUTCOME_LABEL = {
  passed: '통과',
  rejected: '거절 (한도 초과)',
  deduped: '같은 키라 첫 결과 반환',
} as const;

export default function Simulator() {
  const [method, setMethod] = useState<Allocation>('ratio');
  const [prices, setPrices] = useState<number[]>([12000, 8000, 5000]);
  const [discount, setDiscount] = useState(5000);

  const [guard, setGuard] = useState<Guard>('none');
  const [kind, setKind] = useState<RequestKind>('distinct');
  const [refunded, setRefunded] = useState(10000);
  const [amountA, setAmountA] = useState(15000);
  const [amountB, setAmountB] = useState(12000);

  const items: Item[] = ITEM_NAMES.map((name, i) => ({ name, price: prices[i] }));
  const alloc = allocate(items, discount, method);

  const sameRequest = kind === 'same';
  const raced = race({
    paid: RACE_PAID,
    refunded,
    amountA,
    amountB,
    sameRequest,
    guard,
  });

  const setPrice = (idx: number, value: number) => setPrices((prev) => prev.map((p, i) => (i === idx ? value : p)));

  return (
    <div className="rf-lab">
      <section className="rf-section" aria-labelledby="rf-alloc-title">
        <h3 id="rf-alloc-title">주문 쿠폰 할인 배분</h3>
        <RadioGroup
          label="배분 방식"
          options={ALLOCATIONS.map((m) => ({ value: m, label: ALLOCATION_LABEL[m] }))}
          value={method}
          onValueChange={setMethod}
        />
        <p className="rf-hint">{ALLOCATION_HINT[method]}</p>

        <div className="rf-controls">
          {ITEM_NAMES.map((name, i) => (
            <label className="rf-field" key={name}>
              <span>
                {name} {won(prices[i])}
              </span>
              <input
                type="range"
                min={1000}
                max={30000}
                step={1000}
                value={prices[i]}
                onChange={(e) => setPrice(i, Number(e.target.value))}
              />
            </label>
          ))}
          <label className="rf-field">
            <span>주문 쿠폰 할인 {won(discount)}</span>
            <input
              type="range"
              min={0}
              max={20000}
              step={500}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
            {alloc.discount !== discount && <small>상품 합을 넘어서 {won(alloc.discount)}까지만 적용했어요.</small>}
          </label>
        </div>

        <table className="rf-table">
          <caption>상품별 환불액 (상품 하나만 취소할 때)</caption>
          <thead>
            <tr>
              <th scope="col">상품</th>
              <th scope="col">금액</th>
              <th scope="col">배분된 할인</th>
              <th scope="col">환불액</th>
            </tr>
          </thead>
          <tbody>
            {alloc.rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{won(row.price)}</td>
                <td>{won(row.share)}</td>
                <td>{won(row.refund)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="rf-results" aria-label="배분 결과">
          <Stat label="결제액" value={won(alloc.paid)} />
          <Stat label="전체 취소 환불 합계" value={won(alloc.fullRefundSum)} />
          <Stat label="결제액 초과" value={won(alloc.overRefund)} tone={alloc.overRefund > 0 ? 'accent' : 'ink'} />
        </section>

        {method === 'ratio' && alloc.remainder > 0 && (
          <p className="rf-note">
            끝수 {alloc.remainder}원은 금액이 큰 줄부터 1원씩 배정했어요. 예시 규칙이고, 회사 정책은 따로 정해야 해요.
          </p>
        )}
        {method === 'ratio' && alloc.roundingGap !== 0 && (
          <p className="rf-note">
            줄마다 반올림만 하면 할인 합계가 {Math.abs(alloc.roundingGap)}원{' '}
            {alloc.roundingGap < 0 ? '모자라요' : '넘어요'}.
          </p>
        )}
        {alloc.overRefund > 0 && (
          <p className="rf-alarm" role="status">
            전체 취소 환불이 결제액보다 {won(alloc.overRefund)} 많아요. 할인을 줄에 나누지 않으면 생기는 차이예요.
          </p>
        )}
      </section>

      <section className="rf-section" aria-labelledby="rf-race-title">
        <h3 id="rf-race-title">동시 부분 환불 두 건</h3>
        <p className="rf-hint">
          원 결제액 {won(RACE_PAID)} 주문이에요. 환불 가능 잔액은 결제액에서 이미 환불한 합계를 뺀 값이에요.
        </p>

        <RadioGroup
          label="방어 방식"
          options={GUARDS.map((g) => ({ value: g, label: GUARD_LABEL[g] }))}
          value={guard}
          onValueChange={setGuard}
        />
        <p className="rf-hint">{GUARD_HINT[guard]}</p>

        <RadioGroup
          label="요청 구성"
          options={[
            { value: 'distinct', label: '서로 다른 두 건' },
            { value: 'same', label: '같은 요청 두 번 (더블 클릭)' },
          ]}
          value={kind}
          onValueChange={setKind}
        />

        <div className="rf-controls">
          <label className="rf-field">
            <span>이미 환불한 금액 {won(refunded)}</span>
            <input
              type="range"
              min={0}
              max={30000}
              step={1000}
              value={refunded}
              onChange={(e) => setRefunded(Number(e.target.value))}
            />
          </label>
          <label className="rf-field">
            <span>요청 A 환불액 {won(amountA)}</span>
            <input
              type="range"
              min={1000}
              max={30000}
              step={1000}
              value={amountA}
              onChange={(e) => setAmountA(Number(e.target.value))}
            />
          </label>
          <label className="rf-field">
            <span>요청 B 환불액 {won(amountB)}</span>
            <input
              type="range"
              min={1000}
              max={30000}
              step={1000}
              value={amountB}
              disabled={sameRequest}
              onChange={(e) => setAmountB(Number(e.target.value))}
            />
            {sameRequest && <small>같은 요청이라 요청 A 와 같은 금액이에요.</small>}
          </label>
        </div>

        <section className="rf-results" aria-label="환불 결과">
          <Stat label="환불 가능 잔액" value={won(raced.available)} />
          <Stat label="누적 환불액" value={won(raced.total)} />
          <Stat label="결제액 초과" value={won(raced.excess)} tone={raced.excess > 0 ? 'accent' : 'ink'} />
        </section>

        <ol className="rf-steps">
          {raced.steps.map((step) => (
            <li key={step.label}>
              <span>{step.label}</span> <span>{won(step.amount)}</span>{' '}
              <Tag variant={step.outcome === 'passed' ? 'neutral' : 'accent'}>{OUTCOME_LABEL[step.outcome]}</Tag>
              <span className="rf-steps__after"> 누적 {won(step.refundedAfter)}</span>
            </li>
          ))}
        </ol>

        {raced.excess > 0 && (
          <p className="rf-alarm" role="status">
            누적 환불이 결제액을 {won(raced.excess)} 넘어요. 두 요청이 같은 옛 잔액을 보고 둘 다 통과했기 때문이에요.
          </p>
        )}
      </section>

      <p className="rf-footnote">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
