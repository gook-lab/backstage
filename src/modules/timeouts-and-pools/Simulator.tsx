import { Alert, Checkbox, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { type PoolScenario, layerWarnings, simulate } from './model';
import './Simulator.css';

interface RangeProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
}

function Range({ label, min, max, step = 1, value, onChange }: RangeProps) {
  return (
    <label className="tp-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function Simulator() {
  const [rps, setRps] = useState(20);
  const [poolSize, setPoolSize] = useState(5);
  const [avgQueryMs, setAvgQueryMs] = useState(100);
  const [slowPct, setSlowPct] = useState(5);
  const [slowQueryMs, setSlowQueryMs] = useState(3000);
  const [clientSec, setClientSec] = useState(8);
  const [proxySec, setProxySec] = useState(5);
  const [dbSec, setDbSec] = useState(10);
  const [retries, setRetries] = useState(1);
  const [cancelOnGiveUp, setCancelOnGiveUp] = useState(false);

  const scenario: PoolScenario = {
    rps,
    poolSize,
    avgQueryMs,
    slowRatio: slowPct / 100,
    slowQueryMs,
    clientTimeoutMs: clientSec * 1000,
    proxyTimeoutMs: proxySec * 1000,
    dbTimeoutMs: dbSec * 1000,
    retries,
    cancelOnGiveUp,
  };
  const r = simulate(scenario);
  const warnings = layerWarnings(scenario);
  const rate504 = r.attempts > 0 ? ((r.gateway504 / r.attempts) * 100).toFixed(1) : '0.0';
  const peak = Math.max(1, r.maxQueue);

  return (
    <section className="tp" aria-labelledby="tp-title">
      <h3 id="tp-title" className="tp-title">
        타임아웃과 풀 놀이터
      </h3>
      <p className="tp-hint">
        1초에 요청 {rps}건을 20초 동안 보내요. 쿼리가 풀을 잡고 있는 동안 나머지 요청은 줄을 서요.
      </p>

      <div className="tp-group" role="group" aria-label="부하와 풀">
        <Range label={`초당 요청 ${rps}건`} min={5} max={50} step={5} value={rps} onChange={setRps} />
        <Range label={`커넥션 풀 ${poolSize}개`} min={1} max={20} value={poolSize} onChange={setPoolSize} />
        <Range
          label={`보통 쿼리 ${avgQueryMs}ms`}
          min={10}
          max={500}
          step={10}
          value={avgQueryMs}
          onChange={setAvgQueryMs}
        />
        <Range label={`느린 쿼리 비율 ${slowPct}%`} min={0} max={30} step={5} value={slowPct} onChange={setSlowPct} />
        <Range
          label={`느린 쿼리 ${slowQueryMs}ms`}
          min={500}
          max={10000}
          step={500}
          value={slowQueryMs}
          onChange={setSlowQueryMs}
        />
      </div>

      <div className="tp-group" role="group" aria-label="계층별 타임아웃">
        <Range
          label={`클라이언트 타임아웃 ${clientSec}초`}
          min={1}
          max={30}
          value={clientSec}
          onChange={setClientSec}
        />
        <Range label={`프록시 타임아웃 ${proxySec}초`} min={1} max={30} value={proxySec} onChange={setProxySec} />
        <Range label={`DB statement_timeout ${dbSec}초`} min={1} max={30} value={dbSec} onChange={setDbSec} />
      </div>

      <div className="tp-group" role="group" aria-label="재시도와 취소">
        <Range label={`재시도 ${retries}번`} min={0} max={3} value={retries} onChange={setRetries} />
        <Checkbox
          label="포기하면 대기와 DB 작업도 취소해요"
          hint="끄면 앞단이 떠난 뒤에도 서버가 쿼리를 끝까지 실행해요."
          checked={cancelOnGiveUp}
          onCheckedChange={(checked) => setCancelOnGiveUp(checked === true)}
        />
      </div>

      {warnings.length > 0 ? (
        warnings.map((w) => <Alert key={w} tone="warning" title={w} />)
      ) : (
        <Alert tone="info" title="시간 제한이 안쪽부터 끊기도록 맞춰져 있어요." />
      )}

      <section className="tp-stats" aria-label="시뮬레이션 결과">
        <Stat label="전체 시도" value={r.attempts} unit="건" />
        <Stat label="정상 응답" value={r.ok} unit="건" />
        <Stat label="504 비율" value={rate504} unit="%" tone={r.gateway504 > 0 ? 'accent' : 'ink'} />
        <Stat label="클라이언트 타임아웃" value={r.clientTimeouts} unit="건" />
        <Stat label="최대 대기열" value={r.maxQueue} unit="건" />
        <Stat label="포기 뒤에도 실행" value={r.abandoned} unit="건" tone={r.abandoned > 0 ? 'accent' : 'ink'} />
      </section>

      <p className="tp-summary" aria-live="polite">
        시도 {r.attempts}개 중 정상 {r.ok}개, 504 {r.gateway504}개, 클라이언트 타임아웃 {r.clientTimeouts}개, DB 오류{' '}
        {r.dbErrors}개예요. 포기한 뒤에도 서버가 실행한 시도는 {r.abandoned}개예요.
      </p>

      <div className="tp-queue">
        <span className="tp-queue__label">1초마다 본 대기열</span>
        <div className="tp-bars" role="img" aria-label={`1초마다 본 대기열 길이, 최대 ${r.maxQueue}건`}>
          {r.queueEverySecond.map((q, i) => (
            <span key={i} className="tp-bar" style={{ height: `${(q / peak) * 100}%` }} />
          ))}
        </div>
      </div>

      <p className="tp-foot">수치는 감을 잡기 위한 예시예요.</p>
    </section>
  );
}
