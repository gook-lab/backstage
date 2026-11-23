import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  AGE_MAX_MIN,
  type Change,
  QUOTE_TTL_MIN,
  QUOTED,
  type Pricing,
  SCENARIO_LABEL,
  SCENARIOS,
  type Scenario,
  STRATEGIES,
  STRATEGY_LABEL,
  type Strategy,
  type Settlement,
  currentPricing,
  settle,
  total,
} from './model';
import './Simulator.css';

const SCENARIO_HINT: Record<Scenario, string> = {
  none: '견적을 받은 뒤 아무것도 바뀌지 않았어요.',
  'price-up': '결제 직전에 상품 가격이 올랐어요.',
  'coupon-expired': '견적에 쓴 쿠폰의 기간이 지나 할인이 사라졌어요.',
  'shipping-change': '배송비 기준이 바뀌어 배송비가 올랐어요.',
};

const STRATEGY_HINT: Record<Strategy, string> = {
  'trust-client': '요청에 담긴 금액을 그대로 청구해요. 서버는 금액을 계산하지 않아요.',
  recompute: '서버가 지금 가격으로 다시 계산해 청구해요. 사용자에게는 바뀐 내용을 알리지 않아요.',
  'quote-recompute': '견적 id로 저장된 금액과 재계산 값을 비교해요. 다르면 바뀐 항목을 보여 주고 거절해요.',
};

const KIND_LABEL: Record<Change['kind'], string> = {
  price: '상품 가격',
  coupon: '쿠폰 할인',
  shipping: '배송비',
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function quoteLine(q: Pricing): string {
  return `${won(q.unitPrice)} × ${q.quantity}개 - ${won(q.discount)} + ${won(q.shipping)} = ${won(total(q))}`;
}

function alertText(s: Settlement): string | null {
  if (s.rejected) {
    if (s.reason === 'expired') {
      return `견적 유효 시간 ${QUOTE_TTL_MIN}분이 지나 거절했어요. 새 견적을 받아야 해요.`;
    }
    return `바뀐 항목 ${s.shownChanges.length}개가 있어 거절했어요. 사용자가 다시 확인해야 해요.`;
  }
  if (s.charged !== s.serverTotal) {
    return `청구 금액 ${won(s.charged)}이 서버 계산 금액 ${won(s.serverTotal)}과 달라요.`;
  }
  if (s.charged !== s.quotedTotal && s.shownChanges.length === 0) {
    return `사용자가 본 ${won(s.quotedTotal)}과 다른 ${won(s.charged)}이 안내 없이 청구됐어요.`;
  }
  return null;
}

export default function Simulator() {
  const [scenario, setScenario] = useState<Scenario>('none');
  const [strategy, setStrategy] = useState<Strategy>('trust-client');
  const [ageMin, setAgeMin] = useState(0);
  const [quote, setQuote] = useState<Pricing>(QUOTED);

  const result = settle({ scenario, strategy, quote, ageMin });
  const alert = alertText(result);
  const canReconfirm = strategy === 'quote-recompute' && result.rejected;

  const chooseScenario = (next: Scenario) => {
    setScenario(next);
    setQuote(QUOTED);
    setAgeMin(0);
  };

  const reconfirm = () => {
    setQuote(currentPricing(scenario));
    setAgeMin(0);
  };

  return (
    <div className="cq-lab">
      <RadioGroup
        label="결제 직전 사건"
        options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))}
        value={scenario}
        onValueChange={chooseScenario}
      />
      <p className="cq-lab__hint">{SCENARIO_HINT[scenario]}</p>

      <RadioGroup
        label="처리 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="cq-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <div className="cq-lab__controls">
        <label className="cq-field">
          <span>
            견적을 받고 흐른 시간 {ageMin}분 (유효 시간 {QUOTE_TTL_MIN}분)
          </span>
          <input
            type="range"
            min={0}
            max={AGE_MAX_MIN}
            step={1}
            value={ageMin}
            disabled={strategy !== 'quote-recompute'}
            onChange={(e) => setAgeMin(Number(e.target.value))}
          />
          {strategy !== 'quote-recompute' && <small>견적 id를 쓰는 방식에서만 만료를 확인해요.</small>}
        </label>
      </div>

      <p className="cq-lab__note">견적 금액 구성 · {quoteLine(quote)}</p>

      {alert && (
        <p className="cq-lab__alarm" role="status">
          {alert}
        </p>
      )}

      {canReconfirm && (
        <div className="cq-lab__reconfirm">
          <Button variant="secondary" size="sm" onClick={reconfirm}>
            {result.reason === 'changed' ? '바뀐 금액으로 다시 견적 받기' : '다시 견적 받기'}
          </Button>
        </div>
      )}

      <section className="cq-lab__results" aria-label="결과">
        <Stat label="사용자가 본 금액" value={won(result.quotedTotal)} />
        <Stat label="서버 계산 금액" value={won(result.serverTotal)} />
        <Stat label="청구 금액" value={result.rejected ? '없음 (거절)' : won(result.charged)} />
        <Stat
          label="거절 여부"
          value={result.rejected ? (result.reason === 'expired' ? '만료로 거절' : '변경으로 거절') : '통과'}
        />
      </section>

      <section className="cq-lab__changes" aria-labelledby="cq-changes-title">
        <h3 id="cq-changes-title">사용자에게 보여 준 변경 항목</h3>
        {result.shownChanges.length === 0 ? (
          <p className="cq-lab__note">보여 준 변경 항목이 없어요.</p>
        ) : (
          <ul className="cq-lab__list">
            {result.shownChanges.map((c) => (
              <li key={c.kind}>
                {KIND_LABEL[c.kind]} {won(c.before)} → {won(c.after)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="cq-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
