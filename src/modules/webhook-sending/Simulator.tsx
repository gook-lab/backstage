import { Alert, RadioGroup, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  DEFAULT_CONFIG,
  ENDPOINT_LABEL,
  MODE_LABEL,
  simulate,
  verdictOf,
  type Config,
  type EndpointState,
  type Mode,
} from './model';
import './Simulator.css';

const ENDPOINT_OPTIONS = (Object.keys(ENDPOINT_LABEL) as EndpointState[]).map((value) => ({
  value,
  label: ENDPOINT_LABEL[value],
}));

const MODE_OPTIONS = (Object.keys(MODE_LABEL) as Mode[]).map((value) => ({ value, label: MODE_LABEL[value] }));

export default function Simulator() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [cut, setCut] = useState<number | null>(null);

  const result = useMemo(() => simulate(config), [config]);
  const verdict = verdictOf(config, result);
  const tick = cut === null ? result.endTick : Math.min(cut, result.endTick);
  const snapshot = result.snapshots.find((s) => s.t === tick) ?? result.snapshots[result.snapshots.length - 1];
  const visibleLog = result.log.filter((line) => line.t <= tick);

  const update = (patch: Partial<Config>) => {
    setCut(null);
    setConfig((current) => ({ ...current, ...patch }));
  };

  const stats: [string, string][] = [
    ['전송 시도', `${result.attempts}번`],
    ['성공', `${result.delivered}건`],
    ['포기 · 실패', `${result.gaveUp}건`],
    ['보류', `${result.held}건`],
    ['고객 B 가장 늦은 전달', `${result.otherDelay}틱`],
  ];

  const counts: [string, number][] = [
    ['대기 중', snapshot.waiting],
    ['전송 중', snapshot.inflight],
    ['성공', snapshot.delivered],
    ['포기', snapshot.gaveUp],
    ['보류', snapshot.held],
  ];

  return (
    <div className="wh-lab">
      <RadioGroup
        label="고객 A 엔드포인트 상태"
        options={ENDPOINT_OPTIONS}
        value={config.endpoint}
        onValueChange={(v) => update({ endpoint: v })}
      />
      <RadioGroup
        label="발송 설정"
        options={MODE_OPTIONS}
        value={config.mode}
        onValueChange={(v) => update({ mode: v })}
      />

      <label className="wh-lab__range">
        <span>고객당 이벤트 {config.events}건</span>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={config.events}
          onChange={(e) => update({ events: Number(e.target.value) })}
        />
      </label>

      <section className="wh-lab__result" aria-labelledby="wh-result-title">
        <h3 id="wh-result-title">결과</h3>
        <dl className="wh-stats">
          {stats.map(([label, value]) => (
            <div className="wh-stat" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div aria-live="polite">
          <Alert tone={verdict.tone} title={verdict.title} />
        </div>
      </section>

      <section className="wh-lab__timeline" aria-labelledby="wh-timeline-title">
        <h3 id="wh-timeline-title">틱 {tick} 시점</h3>
        <label className="wh-lab__range">
          <span>
            {tick} / {result.endTick} 틱 보기
          </span>
          <input
            type="range"
            min={0}
            max={result.endTick}
            value={tick}
            onChange={(e) => setCut(Number(e.target.value))}
          />
        </label>
        <dl className="wh-counts">
          {counts.map(([label, value]) => (
            <div className="wh-stat" key={label}>
              <dt>{label}</dt>
              <dd>{value}건</dd>
            </div>
          ))}
        </dl>
        <ol className="wh-log">
          {visibleLog.map((line, i) => (
            <li className="wh-log__item" data-customer={line.customer} key={i}>
              <span className="wh-log__t">틱 {line.t}</span>
              <Tag variant={line.customer === 'A' ? 'accent' : 'neutral'}>고객 {line.customer}</Tag>
              <span className="wh-log__text">{line.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="wh-lab__note">수치는 감을 잡기 위한 예시예요. 1틱은 1분으로 가정했어요.</p>
    </div>
  );
}
