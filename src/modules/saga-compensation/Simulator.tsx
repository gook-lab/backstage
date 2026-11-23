import { Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  COMP_FAULT_LABEL,
  COMP_FAULTS,
  COMP_LABEL,
  type CompFault,
  type FailAt,
  FAIL_LABEL,
  FAIL_OPTIONS,
  type OrderStatus,
  type Result,
  STEP_LABEL,
  type Step,
  type Strategy,
  STRATEGIES,
  STRATEGY_LABEL,
  simulate,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  none: '실패하면 거기서 멈춰요. 앞 단계에서 낸 효과와 처리 중 주문이 그대로 남아요.',
  compensate: '완료된 단계를 역순으로 되돌려요. 보상이 한 번 실패하면 거기서 멈춰요.',
  'compensate-retry': '보상 작업을 최대 3번까지 시도해요. 실패하면 같은 보상 작업을 다시 보내요.',
};

const FAIL_REASON: Record<Exclude<FailAt, 'none'>, string> = {
  payment: '결제가 거절됐어요.',
  inventory: '재고가 부족해요.',
  shipping: '배송 업체 요청이 실패했어요.',
};

const ORDER_TEXT: Record<OrderStatus, string> = {
  pending: '처리 중',
  confirmed: '완료',
  canceled: '취소',
};

function moneyText(money: number): string {
  if (money > 0) return '승인 유지';
  if (money === 0) return '없음';
  return '초과 환불';
}

function stockText(stock: number): string {
  if (stock > 0) return '차감 유지';
  if (stock === 0) return '정상';
  return '초과 복구';
}

function eventLabel(step: Step, phase: 'forward' | 'compensate'): string {
  if (phase === 'forward') return STEP_LABEL[step];
  return COMP_LABEL[step as Exclude<Step, 'shipping'>];
}

function resultText(e: Result['events'][number]): string {
  if (e.phase === 'forward') {
    return e.effect ? '완료' : `실패 · ${FAIL_REASON[e.step as Exclude<FailAt, 'none'>]}`;
  }
  if (e.effect && e.reported) return e.duplicate ? '완료 · 같은 작업을 한 번 더 적용' : '완료';
  if (!e.effect && e.reported) return '이미 끝난 작업이라 건너뜀';
  if (e.effect && !e.reported) return '처리는 됐지만 응답을 못 받아 실패로 봄';
  return '실패';
}

export default function Simulator() {
  const [failAt, setFailAt] = useState<FailAt>('inventory');
  const [strategy, setStrategy] = useState<Strategy>('none');
  const [compFault, setCompFault] = useState<CompFault>('none');
  const [idempotent, setIdempotent] = useState(true);

  const r = simulate({ failAt, strategy, compFault, idempotent });
  const fin = r.final;

  return (
    <div className="sg-lab">
      <RadioGroup
        label="실패가 나는 단계"
        options={FAIL_OPTIONS.map((f) => ({ value: f, label: FAIL_LABEL[f] }))}
        value={failAt}
        onValueChange={setFailAt}
      />

      <RadioGroup
        label="실패 뒤 처리 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="sg-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <RadioGroup
        label="보상 작업에서 일어나는 일"
        options={COMP_FAULTS.map((c) => ({ value: c, label: COMP_FAULT_LABEL[c] }))}
        value={compFault}
        onValueChange={setCompFault}
      />
      <p className="sg-lab__hint">
        보상 단계마다 첫 시도에 이 일이 일어나요. &apos;처리됐지만 응답 유실&apos; 은 효과는 났는데 실패로 보이는
        경우예요.
      </p>

      <Checkbox
        label="보상 작업을 멱등하게 만들어요"
        hint="같은 보상이 두 번 실행돼도 효과를 한 번만 내요. 끄면 재시도가 효과를 한 번 더 내요."
        checked={idempotent}
        onCheckedChange={(checked) => setIdempotent(checked === true)}
      />

      <section className="sg-lab__results" aria-label="결과">
        <Stat label="주문 상태" value={ORDER_TEXT[fin.order]} />
        <Stat label="결제" value={moneyText(r.money)} tone={r.money !== 0 ? 'accent' : 'ink'} />
        <Stat label="재고" value={stockText(r.stock)} tone={r.stock !== 0 ? 'accent' : 'ink'} />
        <Stat label="어긋난 곳" value={r.issues.length} unit="곳" tone={r.issues.length > 0 ? 'accent' : 'ink'} />
      </section>

      <div className="sg-lab__verdict" role="status">
        {r.consistent ? (
          <p>
            <Tag variant="neutral">일관됨</Tag> 모든 서비스가 같은 결론이에요. 전부 완료되었거나 전부 되돌려졌어요.
          </p>
        ) : (
          <>
            <p>
              <Tag variant="accent">어긋남</Tag> 서비스끼리 결론이 달라요.
            </p>
            <ul>
              {r.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            {r.stuckAt && (
              <p className="sg-lab__note">
                보상 &apos;{COMP_LABEL[r.stuckAt]}&apos; 에서 포기했어요. 사람이 확인해야 해요.
              </p>
            )}
          </>
        )}
      </div>

      <table className="sg-table">
        <caption>서비스별 최종 상태</caption>
        <thead>
          <tr>
            <th scope="col">서비스</th>
            <th scope="col">상태</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">주문</th>
            <td>{ORDER_TEXT[fin.order]}</td>
          </tr>
          <tr>
            <th scope="row">결제</th>
            <td>{moneyText(r.money)}</td>
          </tr>
          <tr>
            <th scope="row">재고</th>
            <td>{stockText(r.stock)}</td>
          </tr>
          <tr>
            <th scope="row">배송 요청</th>
            <td>{fin.requested ? '요청됨' : '없음'}</td>
          </tr>
        </tbody>
      </table>

      <section className="sg-lab__log" aria-label="실행 기록">
        <h3>실행 기록 (시도 순서)</h3>
        <ol>
          {r.events.map((e) => (
            <li key={e.tick}>
              <span className="sg-lab__step">
                {eventLabel(e.step, e.phase)}
                {e.attempt > 1 && ` · ${e.attempt}번째 시도`}
              </span>
              <span className="sg-lab__result">{resultText(e)}</span>
              <span className="sg-lab__seen">화면: {ORDER_TEXT[e.order]}</span>
            </li>
          ))}
        </ol>
        <p className="sg-lab__note">
          &apos;화면&apos; 은 그 시점에 손님이 보는 주문 상태예요. {r.pendingTicks}단계 동안 처리 중으로 보였어요.
        </p>
      </section>
    </div>
  );
}
