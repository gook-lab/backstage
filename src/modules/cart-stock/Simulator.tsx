import { Button, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  HORIZON,
  MODE_LABEL,
  MODES,
  type Outcome,
  POLICIES,
  POLICY_LABEL,
  type Policy,
  simulate,
  type WriteMode,
} from './model';
import './Simulator.css';

const POLICY_HINT: Record<Policy, string> = {
  cart: '담는 순간 재고를 잡아요. 손님을 보호하지만, 담기만 하고 떠난 손님이 재고를 붙잡아요.',
  checkout: '결제 화면에 들어갈 때 잡아요. 결제 중 품절은 줄지만, 결제를 망설이는 손님이 재고를 잡아요.',
  payment: '결제가 확정될 때만 차감해요. 잡아 둔 재고가 없어서 결제 때 품절을 볼 수 있어요.',
};

const OUTCOME_ROWS: readonly { id: Outcome; label: string }[] = [
  { id: 'sold', label: '구매 완료' },
  { id: 'sold-out-cart', label: '담을 때 품절' },
  { id: 'sold-out-checkout', label: '결제 화면에서 품절' },
  { id: 'sold-out-pay', label: '결제할 때 품절' },
  { id: 'abandoned', label: '포기' },
];

const SVG_W = 300;
const SVG_H = 72;

function StuckBars({ values, tick }: { values: readonly number[]; tick: number }) {
  const max = Math.max(1, ...values);
  const barW = SVG_W / values.length;
  return (
    <svg
      className="ct-bars"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {values.map((v, i) => {
        const h = (v / max) * (SVG_H - 4);
        return (
          <rect
            key={i}
            className={i === tick ? 'ct-bars__bar ct-bars__bar--now' : 'ct-bars__bar'}
            x={i * barW + 0.5}
            y={SVG_H - h}
            width={Math.max(1, barW - 1)}
            height={h}
          />
        );
      })}
    </svg>
  );
}

export default function Simulator() {
  const chartId = useId();
  const [policy, setPolicy] = useState<Policy>('cart');
  const [mode, setMode] = useState<WriteMode>('atomic');
  const [stock, setStock] = useState(20);
  const [shoppers, setShoppers] = useState(60);
  const [ttl, setTtl] = useState(8);
  const [abandonPct, setAbandonPct] = useState(30);
  const [seed, setSeed] = useState(7);
  const [tick, setTick] = useState(HORIZON);

  const result = simulate({ policy, mode, stock, shoppers, ttl, abandonRate: abandonPct / 100, seed });

  const soldNow = result.soldByTick[tick];
  const heldNow = result.heldByTick[tick];
  const leftNow = stock - soldNow - heldNow;
  const stuckPeak = Math.max(...result.stuckByTick);

  return (
    <div className="ct-lab">
      <RadioGroup
        label="재고를 줄이는 시점"
        options={POLICIES.map((p) => ({ value: p, label: POLICY_LABEL[p] }))}
        value={policy}
        onValueChange={setPolicy}
      />
      <p className="ct-lab__hint">{POLICY_HINT[policy]}</p>

      <RadioGroup
        label="차감 방식"
        options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        value={mode}
        onValueChange={setMode}
      />
      <p className="ct-lab__hint">
        {mode === 'atomic'
          ? '조건 확인과 차감을 한 문장으로 해요. 재고가 없으면 0 행이 갱신돼요.'
          : '같은 순간에 들어온 요청이 모두 같은 옛 재고를 읽고 통과해요. 읽기와 쓰기 사이에 틈이 있어요.'}
      </p>

      <div className="ct-lab__controls">
        <label className="ct-field">
          <span>재고 {stock}개</span>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
        </label>
        <label className="ct-field">
          <span>손님 {shoppers}명</span>
          <input
            type="range"
            min={20}
            max={120}
            step={5}
            value={shoppers}
            onChange={(e) => setShoppers(Number(e.target.value))}
          />
        </label>
        <label className="ct-field">
          <span>보류 시간 TTL {ttl}틱</span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={ttl}
            disabled={policy === 'payment'}
            onChange={(e) => setTtl(Number(e.target.value))}
          />
          {policy === 'payment' && <small>결제 확정 방식은 보류를 만들지 않아서 TTL 이 영향을 주지 않아요.</small>}
        </label>
        <label className="ct-field">
          <span>포기하는 손님 {abandonPct}%</span>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={abandonPct}
            onChange={(e) => setAbandonPct(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="ct-lab__seed">
        <span>시드 {seed} · 같은 시드는 항상 같은 손님 흐름이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="ct-lab__results" aria-label="결과">
        <Stat label="팔린 수량 / 재고" value={`${result.sold} / ${stock}`} />
        <Stat label="초과 판매" value={result.oversold} unit="개" tone={result.oversold > 0 ? 'accent' : 'ink'} />
        <Stat label="결제 때 품절을 본 손님" value={result.counts['sold-out-pay']} unit="명" />
        <Stat label="품절을 한 번이라도 본 손님" value={result.soldOutSeen} unit="명" />
      </section>

      {result.oversold > 0 && (
        <p className="ct-lab__alarm" role="status">
          팔린 수량이 재고보다 {result.oversold}개 많아요. 같은 재고를 여러 명이 동시에 차지했어요.
        </p>
      )}

      <section className="ct-lab__stuck" aria-labelledby={`${chartId}-stuck`}>
        <h3 id={`${chartId}-stuck`}>포기한 손님이 잡아 둔 재고 (시각별)</h3>
        <StuckBars values={result.stuckByTick} tick={tick} />
        <p className="ct-lab__note">
          최대 {stuckPeak}개가 묶였어요. 틱 {tick} 에는 {result.stuckByTick[tick]}개가 묶여 있어요.
        </p>
      </section>

      <section className="ct-lab__timeline" aria-labelledby={`${chartId}-tl`}>
        <h3 id={`${chartId}-tl`}>시각별 상태</h3>
        <label className="ct-field">
          <span>
            틱 {tick} / {HORIZON} (시뮬레이터의 시간 단위예요)
          </span>
          <input
            type="range"
            min={0}
            max={HORIZON}
            step={1}
            value={tick}
            onChange={(e) => setTick(Number(e.target.value))}
          />
        </label>
        <dl className="ct-lab__now">
          <div>
            <dt>누적 판매</dt>
            <dd>{soldNow}</dd>
          </div>
          <div>
            <dt>보류 중</dt>
            <dd>{heldNow}</dd>
          </div>
          <div>
            <dt>남은 재고</dt>
            <dd>
              {leftNow}
              {leftNow < 0 && <Tag variant="accent">초과 판매</Tag>}
            </dd>
          </div>
        </dl>
      </section>

      <table className="ct-table">
        <caption>손님 {shoppers}명의 결과</caption>
        <thead>
          <tr>
            <th scope="col">결과</th>
            <th scope="col">명</th>
          </tr>
        </thead>
        <tbody>
          {OUTCOME_ROWS.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{result.counts[row.id]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
