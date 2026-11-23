import { Button, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  FINAL_LABEL,
  FINAL_OUTCOMES,
  type FinalOutcome,
  GRACE_OPTIONS,
  HORIZON,
  PLAN_IDS,
  PLAN_LABEL,
  PLAN_PRICE_WON,
  type PlanId,
  PRORATION_LABEL,
  PRORATION_MODES,
  type ProrationMode,
  RETRY_LABEL,
  RETRY_PLANS,
  type RetryPlan,
  type SubStatus,
  computeProration,
  recoverOptions,
  simulateDunning,
} from './model';
import './Simulator.css';

const MODE_HINT: Record<ProrationMode, string> = {
  immediate: '변경하는 순간 차액을 청구해요. 내리면 청구는 0원이고, 차액은 크레딧 잔액으로 남아요.',
  'next-invoice': '차액은 이번 주기 끝의 청구서에 함께 찍혀요. 변경하는 순간에는 아무것도 청구하지 않아요.',
  none: '일할 계산을 끄면 이번 주기의 차액이 없어요. 다음 청구부터 새 플랜 정가가 나가요.',
};

const STATUS_LABEL: Record<SubStatus, string> = {
  active: '정상 (active)',
  past_due: '결제 밀림 (past_due)',
  unpaid: '미납 (unpaid)',
  canceled: '해지 (canceled)',
};

const PLAN_OPTIONS = PLAN_IDS.map((p) => ({
  value: p,
  label: `${PLAN_LABEL[p]} ${won(PLAN_PRICE_WON[p])}/월`,
}));

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function recoverLabel(n: number): string {
  return n === 0 ? '모두 실패' : `${n}번째 재시도에서 성공`;
}

const DEFAULTS = {
  fromPlan: 'basic' as PlanId,
  toPlan: 'pro' as PlanId,
  changeDay: 16,
  mode: 'immediate' as ProrationMode,
  retryPlan: 'short' as RetryPlan,
  recoverAt: 0,
  finalOutcome: 'past_due' as FinalOutcome,
  graceDays: 3,
  day: 0,
};

export default function Simulator() {
  const sectionId = useId();
  const [fromPlan, setFromPlan] = useState<PlanId>(DEFAULTS.fromPlan);
  const [toPlan, setToPlan] = useState<PlanId>(DEFAULTS.toPlan);
  const [changeDay, setChangeDay] = useState(DEFAULTS.changeDay);
  const [mode, setMode] = useState<ProrationMode>(DEFAULTS.mode);
  const [retryPlan, setRetryPlan] = useState<RetryPlan>(DEFAULTS.retryPlan);
  const [recoverAt, setRecoverAt] = useState(DEFAULTS.recoverAt);
  const [finalOutcome, setFinalOutcome] = useState<FinalOutcome>(DEFAULTS.finalOutcome);
  const [graceDays, setGraceDays] = useState(DEFAULTS.graceDays);
  const [day, setDay] = useState(DEFAULTS.day);

  const pr = computeProration({
    fromPrice: PLAN_PRICE_WON[fromPlan],
    toPrice: PLAN_PRICE_WON[toPlan],
    changeDay,
    mode,
  });

  const options = recoverOptions(retryPlan);
  const effectiveRecover = options.includes(recoverAt) ? recoverAt : 0;
  const dun = simulateDunning({ retryPlan, recoverAt: effectiveRecover, finalOutcome, graceDays });
  const row = dun.days[day];

  const reset = () => {
    setFromPlan(DEFAULTS.fromPlan);
    setToPlan(DEFAULTS.toPlan);
    setChangeDay(DEFAULTS.changeDay);
    setMode(DEFAULTS.mode);
    setRetryPlan(DEFAULTS.retryPlan);
    setRecoverAt(DEFAULTS.recoverAt);
    setFinalOutcome(DEFAULTS.finalOutcome);
    setGraceDays(DEFAULTS.graceDays);
    setDay(DEFAULTS.day);
  };

  return (
    <div className="sb-lab">
      <section className="sb-lab__section" aria-labelledby={`${sectionId}-pr`}>
        <h3 id={`${sectionId}-pr`}>플랜 변경 — 이번 청구와 다음 청구</h3>

        <div className="sb-lab__pair">
          <RadioGroup label="현재 플랜" options={PLAN_OPTIONS} value={fromPlan} onValueChange={setFromPlan} />
          <RadioGroup label="바꿀 플랜" options={PLAN_OPTIONS} value={toPlan} onValueChange={setToPlan} />
        </div>

        <label className="sb-field">
          <span>
            변경일 {changeDay}일째 (남은 기간 {pr.remainingDays}일)
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={changeDay}
            onChange={(e) => setChangeDay(Number(e.target.value))}
          />
        </label>

        <RadioGroup
          label="일할 계산 방식"
          options={PRORATION_MODES.map((m) => ({ value: m, label: PRORATION_LABEL[m] }))}
          value={mode}
          onValueChange={setMode}
        />
        <p className="sb-lab__hint">{MODE_HINT[mode]}</p>
        {fromPlan === toPlan && <p className="sb-lab__hint">같은 플랜이라 변경이 없고, 차액도 없어요.</p>}

        <section className="sb-lab__results" aria-label="플랜 변경 결과">
          <Stat label="이번 청구" value={won(pr.chargeNow)} />
          <Stat label="남은 크레딧" value={won(pr.creditBalance)} />
          <Stat label="다음 청구서" value={won(pr.nextInvoice)} />
        </section>

        <table className="sb-table">
          <caption>금액 계산 내역 (원 단위, 0.5 는 올림)</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">기존 플랜 미사용분 (크레딧)</th>
              <td>{pr.creditOld > 0 ? `-${won(pr.creditOld)}` : won(0)}</td>
            </tr>
            <tr>
              <th scope="row">새 플랜 남은 기간 (차감)</th>
              <td>{pr.debitNew > 0 ? `+${won(pr.debitNew)}` : won(0)}</td>
            </tr>
            <tr>
              <th scope="row">차액 (차감 - 크레딧)</th>
              <td>{pr.net > 0 ? `+${won(pr.net)}` : pr.net < 0 ? `-${won(-pr.net)}` : won(0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="sb-lab__note">계산식은 이 모델 기준이에요. 남은 일수 ÷ 30 을 곱하고 원 단위로 반올림해요.</p>
      </section>

      <section className="sb-lab__section" aria-labelledby={`${sectionId}-dun`}>
        <h3 id={`${sectionId}-dun`}>결제 실패 — 재시도 · 유예 · 기능 차단</h3>
        <p className="sb-lab__hint">갱신 결제 실패일을 0일로 봐요. 0일부터 재시도 간격을 누적해요.</p>

        <RadioGroup
          label="재시도 일정"
          options={RETRY_PLANS.map((p) => ({ value: p, label: RETRY_LABEL[p] }))}
          value={retryPlan}
          onValueChange={(v) => {
            setRetryPlan(v);
            setRecoverAt(0);
          }}
        />
        <RadioGroup
          label="재시도 결과"
          options={options.map((n) => ({ value: String(n), label: recoverLabel(n) }))}
          value={String(effectiveRecover)}
          onValueChange={(v) => setRecoverAt(Number(v))}
        />
        <RadioGroup
          label="마지막 재시도 뒤 결과"
          options={FINAL_OUTCOMES.map((f) => ({ value: f, label: FINAL_LABEL[f] }))}
          value={finalOutcome}
          onValueChange={setFinalOutcome}
        />
        <RadioGroup
          label="유예 기간 (실패 뒤 기능 유지)"
          options={GRACE_OPTIONS.map((g) => ({ value: String(g), label: g === 0 ? '없음 (즉시 차단)' : `${g}일` }))}
          value={String(graceDays)}
          onValueChange={(v) => setGraceDays(Number(v))}
        />
        <p className="sb-lab__hint">
          기능을 막는 기준은 Stripe 상태가 아니라 우리 정책이에요. past_due 여도 유예가 끝나면 막아요.
        </p>

        <section className="sb-lab__results" aria-label="결제 실패 결과">
          <Stat label="청구 시도" value={dun.attemptDays.length} unit="회" />
          <Stat label={`기능 열린 날 (0~${HORIZON}일)`} value={dun.accessDaysCount} unit="일" />
          <Stat
            label="기능이 막히는 날"
            value={dun.blockedFrom === null ? '없음' : `${dun.blockedFrom}일째`}
            tone={dun.blockedFrom === null ? 'ink' : 'accent'}
          />
        </section>

        <p className="sb-lab__note">
          청구 시도는 {dun.attemptDays.map((d) => `${d}일`).join(' · ')}이에요.{' '}
          {dun.recoveredOn === null
            ? `최종 결과(${STATUS_LABEL[finalOutcome]})는 ${dun.finalStartDay}일째부터 적용해요.`
            : `${dun.recoveredOn}일째에 결제가 되어 active 로 돌아가요.`}
        </p>

        <div className="sb-strip" aria-hidden="true">
          {dun.days.map((d) => (
            <span
              key={d.day}
              className={`sb-strip__cell sb-strip__cell--${d.status}${d.access ? '' : ' sb-strip__cell--blocked'}`}
            />
          ))}
        </div>
        <p className="sb-lab__note">
          띠는 날짜별 상태예요. 어두운 칸은 기능이 막힌 날이에요. 같은 내용을 아래 표로도 읽을 수 있어요.
        </p>

        <div className="sb-lab__day">
          <label className="sb-field">
            <span>
              {day}일째 보기 (0~{HORIZON})
            </span>
            <input
              type="range"
              min={0}
              max={HORIZON}
              step={1}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          </label>
          <dl className="sb-lab__now">
            <div>
              <dt>구독 상태</dt>
              <dd>{STATUS_LABEL[row.status]}</dd>
            </div>
            <div>
              <dt>청구 시도</dt>
              <dd>{row.attempt ? '이날 청구를 시도해요' : '시도 없음'}</dd>
            </div>
            <div>
              <dt>기능 접근</dt>
              <dd>{row.access ? <Tag variant="neutral">열림</Tag> : <Tag variant="accent">막힘</Tag>}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="sb-lab__reset">
        <Button variant="secondary" size="sm" onClick={reset}>
          예시 값으로 되돌리기
        </Button>
        <span>수치는 감을 잡기 위한 예시예요.</span>
      </div>
    </div>
  );
}
