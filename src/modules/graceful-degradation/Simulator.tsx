import { Alert, Checkbox, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DURATION_SEC,
  type DegradeScenario,
  FAULT_END_SEC,
  FAULT_START_SEC,
  SYNCED_BATCH,
  simulateDegrade,
} from './model';
import './Simulator.css';

interface RangeProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}

function Range({ label, min, max, step = 1, value, disabled = false, onChange }: RangeProps) {
  return (
    <label className="gd-slider" data-disabled={disabled || undefined}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface BarsProps {
  label: string;
  values: number[];
}

/** 1초마다 값을 막대로 보여 줘요. 장애 구간은 옅은 막대로 구분해요 */
function Bars({ label, values }: BarsProps) {
  const peak = Math.max(1, ...values);
  const max = Math.max(...values);
  return (
    <div className="gd-chart">
      <span className="gd-chart__label">{label}</span>
      <div className="gd-bars" role="img" aria-label={`${label}, 가장 많은 초 ${max}건`}>
        {values.map((v, i) => {
          const fault = i >= FAULT_START_SEC && i < FAULT_END_SEC;
          return (
            <span
              key={i}
              className="gd-bar"
              data-fault={fault || undefined}
              style={{ height: `${(v / peak) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="gd-axis" aria-hidden="true">
        <span>0초</span>
        <span>
          {FAULT_START_SEC}초 · {FAULT_END_SEC}초 장애 구간
        </span>
        <span>{DURATION_SEC}초</span>
      </div>
    </div>
  );
}

export default function Simulator() {
  const [rps, setRps] = useState(50);
  const [synced, setSynced] = useState(false);
  const [faultLatencyMs, setFaultLatencyMs] = useState(3000);
  const [faultFailPct, setFaultFailPct] = useState(30);
  const [callTimeoutMs, setCallTimeoutMs] = useState(1000);
  const [retries, setRetries] = useState(1);
  const [breaker, setBreaker] = useState(false);
  const [breakerThreshold, setBreakerThreshold] = useState(5);
  const [breakerOpenSec, setBreakerOpenSec] = useState(5);
  const [jitter, setJitter] = useState(false);
  const [bulkhead, setBulkhead] = useState(false);
  const [fallback, setFallback] = useState(false);

  const scenario: DegradeScenario = {
    rps,
    synced,
    faultLatencyMs,
    faultFailRate: faultFailPct / 100,
    callTimeoutMs,
    breaker,
    breakerThreshold,
    breakerOpenMs: breakerOpenSec * 1000,
    retries,
    jitter,
    bulkhead,
    fallback,
  };
  const r = simulateDegrade(scenario);
  const blocked = r.breakerBlocked + r.slotBlocked;

  const alerts: { key: string; tone: 'warning' | 'info'; title: string }[] = [];
  if (r.coreFailed > 0) {
    alerts.push({
      key: 'core',
      tone: 'warning',
      title: bulkhead
        ? '칸이 모자라 상품 정보 호출도 실패했어요.'
        : '추천 호출이 칸을 나눠 써서 상품 정보 호출도 실패했어요. 벌크헤드를 켜 보세요.',
    });
  }
  if (r.failed > 0 && !fallback) {
    alerts.push({
      key: 'fallback',
      tone: 'warning',
      title: '추천이 실패하면 페이지 전체가 실패해요. 대체 응답을 켜 보세요.',
    });
  }
  if (r.breakerTrips > 0) {
    alerts.push({
      key: 'breaker',
      tone: 'info',
      title: `서킷이 ${r.breakerTrips}번 열려서 추천 호출 ${r.breakerBlocked}건을 보내지 않았어요.`,
    });
  }
  if (alerts.length === 0) {
    alerts.push({ key: 'ok', tone: 'info', title: '장애 구간에도 상품 정보와 추천이 모두 정상이에요.' });
  }

  return (
    <section className="gd" aria-labelledby="gd-title">
      <h3 id="gd-title" className="gd-title">
        장애 격리 놀이터
      </h3>
      <p className="gd-hint">
        1초에 요청 {rps}건을 {DURATION_SEC}초 동안 보내요. {FAULT_START_SEC}초부터 {FAULT_END_SEC}초까지 추천 서비스가
        느리거나 실패해요.
      </p>

      <div className="gd-group" role="group" aria-label="부하와 장애">
        <Range label={`초당 요청 ${rps}건`} min={10} max={100} step={10} value={rps} onChange={setRps} />
        <Range
          label={`장애 구간 추천 응답 ${faultLatencyMs}ms`}
          min={100}
          max={3000}
          step={100}
          value={faultLatencyMs}
          onChange={setFaultLatencyMs}
        />
        <Range
          label={`장애 구간 추천 실패율 ${faultFailPct}%`}
          min={0}
          max={100}
          step={10}
          value={faultFailPct}
          onChange={setFaultFailPct}
        />
        <Checkbox
          label="요청이 10건씩 같은 순간에 도착해요"
          hint={`동기화된 클라이언트를 흉내 내요. ${SYNCED_BATCH}건씩 한 시각에 들어와요.`}
          checked={synced}
          onCheckedChange={(checked) => setSynced(checked === true)}
        />
      </div>
      <p className="gd-hint">장애 구간 추천 응답이 시간 제한보다 길면 실패율과 상관없이 시간 초과로 끝나요.</p>

      <div className="gd-group" role="group" aria-label="호출과 재시도">
        <Range
          label={`추천 호출 시간 제한 ${callTimeoutMs}ms`}
          min={200}
          max={1500}
          step={100}
          value={callTimeoutMs}
          onChange={setCallTimeoutMs}
        />
        <Range label={`재시도 ${retries}번`} min={0} max={3} value={retries} onChange={setRetries} />
        <Checkbox
          label="재시도 간격에 지터를 넣어요"
          hint="재시도 시각을 0과 백오프 사이에서 무작위로 흩어요."
          checked={jitter}
          onCheckedChange={(checked) => setJitter(checked === true)}
        />
      </div>

      <div className="gd-group" role="group" aria-label="보호 장치">
        <Checkbox
          label="서킷 브레이커를 켜요"
          hint="연속 실패가 임계치에 닿으면 추천 호출을 열림 시간 동안 멈춰요."
          checked={breaker}
          onCheckedChange={(checked) => setBreaker(checked === true)}
        />
        <Range
          label={`실패 임계치 ${breakerThreshold}번`}
          min={1}
          max={10}
          value={breakerThreshold}
          disabled={!breaker}
          onChange={setBreakerThreshold}
        />
        <Range
          label={`열림 유지 ${breakerOpenSec}초`}
          min={1}
          max={20}
          value={breakerOpenSec}
          disabled={!breaker}
          onChange={setBreakerOpenSec}
        />
        <Checkbox
          label="추천 호출에 칸을 따로 떼어 줘요"
          hint="벌크헤드예요. 추천이 칸을 다 써도 상품 정보 칸은 남아요."
          checked={bulkhead}
          onCheckedChange={(checked) => setBulkhead(checked === true)}
        />
        <Checkbox
          label="추천이 실패하면 빈 추천 영역으로 그려요"
          hint="대체 응답이에요. 상품 정보는 그대로 보여 줘요."
          checked={fallback}
          onCheckedChange={(checked) => setFallback(checked === true)}
        />
      </div>

      {alerts.map((a) => (
        <Alert key={a.key} tone={a.tone} title={a.title} />
      ))}

      <section className="gd-stats" aria-label="시뮬레이션 결과">
        <Stat label="정상 응답" value={r.ok} unit="건" />
        <Stat label="대체 응답" value={r.degraded} unit="건" />
        <Stat label="실패" value={r.failed} unit="건" tone={r.failed > 0 ? 'accent' : 'ink'} />
        <Stat label="추천 서비스 호출" value={r.depCalls} unit="건" />
        <Stat label="보내지 않고 막은 호출" value={blocked} unit="건" />
        <Stat label="가장 몰린 10ms 호출" value={r.peakCallsPerTick} unit="건" />
      </section>

      <p className="gd-summary" aria-live="polite">
        사용자 요청 {r.requests}건 중 정상 {r.ok}건, 대체 응답 {r.degraded}건, 실패 {r.failed}건이에요. 실패 가운데{' '}
        {r.coreFailed}건은 추천과 상관없이 상품 정보 호출이 칸을 받지 못한 경우예요.
      </p>

      <Bars label="1초마다 추천 서비스로 간 호출" values={r.perSecond.map((s) => s.depCalls)} />
      <Bars label="1초마다 실패한 요청" values={r.perSecond.map((s) => s.failed)} />

      <p className="gd-foot">수치는 감을 잡기 위한 예시예요.</p>
    </section>
  );
}
