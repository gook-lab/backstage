import { Alert, Button, RadioGroup, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { simulate, verdictOf, type Config, type Strategy } from './model';
import './Simulator.css';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'return-only', label: '복귀만 믿기' },
  { value: 'webhook-only', label: '웹훅만 받기' },
  { value: 'guard', label: '웹훅 + 이벤트 ID 중복 제거 + 상태 전이 검사' },
  { value: 'guard-recon', label: '위 방식 + 주기적 대사 (PG 조회)' },
];

const DEFAULT_CONFIG: Config = {
  strategy: 'webhook-only',
  payments: 100,
  returnLossPercent: 30,
  webhookLossPercent: 10,
  webhookDelayMax: 5,
  duplicatePercent: 20,
  reorderPercent: 20,
  reconEvery: 0,
  seed: 7,
};

const LOG_LIMIT = 80;

export default function Simulator() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  const result = useMemo(() => simulate(config), [config]);
  const verdict = verdictOf(result);

  const update = (patch: Partial<Config>) => setConfig((current) => ({ ...current, ...patch }));

  const stats: [string, string][] = [
    ['틀린 주문 상태', `${result.wrong}건`],
    ['두 번 처리된 주문', `${result.doubleProcessed}건`],
    ['중복 웹훅 제거', `${result.deduped}번`],
    ['전이 검사로 거절', `${result.rejected}번`],
    ['아직 결제 대기', `${result.stillPending}건`],
    ['확정까지 평균', result.avgConfirmTicks === null ? '확정 없음' : `${result.avgConfirmTicks.toFixed(1)}칸`],
  ];

  const sliders: {
    key: keyof Config;
    label: (v: number) => string;
    min: number;
    max: number;
    step: number;
  }[] = [
    { key: 'returnLossPercent', label: (v) => `브라우저 복귀 유실 ${v}%`, min: 0, max: 100, step: 10 },
    { key: 'webhookLossPercent', label: (v) => `웹훅 유실 ${v}%`, min: 0, max: 50, step: 10 },
    { key: 'webhookDelayMax', label: (v) => `웹훅 지연 최대 ${v}칸`, min: 0, max: 10, step: 1 },
    { key: 'duplicatePercent', label: (v) => `웹훅 중복 전송 ${v}%`, min: 0, max: 100, step: 10 },
    { key: 'reorderPercent', label: (v) => `환불 웹훅이 먼저 도착 ${v}%`, min: 0, max: 100, step: 10 },
    {
      key: 'reconEvery',
      label: (v) => (v === 0 ? '대사 안 함' : `대사 주기 ${v}칸마다`),
      min: 0,
      max: 50,
      step: 5,
    },
  ];

  const logLines = result.log.slice(0, LOG_LIMIT);

  return (
    <div className="wh-lab">
      <RadioGroup
        label="처리 방식"
        options={STRATEGY_OPTIONS}
        value={config.strategy}
        onValueChange={(v) => update({ strategy: v })}
      />

      <div className="wh-lab__controls">
        <fieldset className="wh-lab__group">
          <legend>네트워크와 전송</legend>
          {sliders.slice(0, 3).map((s) => (
            <label className="wh-lab__range" key={s.key}>
              <span>{s.label(config[s.key] as number)}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={config[s.key] as number}
                onChange={(e) => update({ [s.key]: Number(e.target.value) } as Partial<Config>)}
              />
            </label>
          ))}
        </fieldset>

        <fieldset className="wh-lab__group">
          <legend>이벤트 순서와 대사</legend>
          {sliders.slice(3).map((s) => (
            <label className="wh-lab__range" key={s.key}>
              <span>{s.label(config[s.key] as number)}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={config[s.key] as number}
                onChange={(e) => update({ [s.key]: Number(e.target.value) } as Partial<Config>)}
              />
            </label>
          ))}
          <div className="wh-lab__dice">
            <span>주사위 {config.seed}</span>
            <Button variant="ghost" size="sm" onClick={() => update({ seed: config.seed + 1 })}>
              주사위 다시 굴리기
            </Button>
          </div>
        </fieldset>
      </div>

      <section className="wh-lab__result" aria-labelledby="wh-result-title">
        <h3 id="wh-result-title">결과 ({result.payments}건의 결제)</h3>
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

      <section className="wh-lab__log" aria-labelledby="wh-log-title">
        <h3 id="wh-log-title">이벤트 기록</h3>
        <ol className="wh-log">
          {logLines.map((line, i) => (
            <li className="wh-log__item" data-tone={line.tone} key={i}>
              <span className="wh-log__t">t={line.t}</span>
              <Tag variant={line.tone === 'ok' ? 'accent' : line.tone === 'warn' ? 'outline' : 'neutral'}>
                {line.tone === 'ok' ? '반영' : line.tone === 'warn' ? '주의' : '수신'}
              </Tag>
              <span className="wh-log__text">{line.text}</span>
            </li>
          ))}
        </ol>
        {result.log.length > LOG_LIMIT && (
          <p className="wh-log__more">
            처음 {LOG_LIMIT}줄만 보여요. 전체 {result.log.length}줄 중에서요.
          </p>
        )}
      </section>
    </div>
  );
}
