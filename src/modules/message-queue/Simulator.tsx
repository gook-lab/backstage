import { Alert, Button, Checkbox, RadioGroup, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { PRESETS, simulate, verdictOf, type Backoff, type Config, type Lane } from './model';
import './Simulator.css';

const LANE_LABEL: Record<Lane, string> = {
  queue: '큐',
  consumer: '소비자',
  dlq: 'DLQ',
};

const LANE_TAG: Record<Lane, 'accent' | 'neutral' | 'outline'> = {
  queue: 'neutral',
  consumer: 'accent',
  dlq: 'outline',
};

const BACKOFF_OPTIONS: { value: Backoff; label: string }[] = [
  { value: 'none', label: '없음 (가시성 시간만큼만 기다려요)' },
  { value: 'exponential', label: '지수 백오프 + jitter' },
];

export default function Simulator() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [config, setConfig] = useState<Config>(PRESETS[0].config);
  const [cut, setCut] = useState<number | null>(null);

  const result = useMemo(() => simulate(config), [config]);
  const verdict = verdictOf(result);
  const total = result.events.length;
  const shown = cut === null ? total : Math.min(cut, total);

  const update = (patch: Partial<Config>) => {
    setPresetId('');
    setCut(null);
    setConfig((current) => ({ ...current, ...patch }));
  };

  const choose = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setCut(null);
    setConfig(preset.config);
  };

  const stats: [string, string][] = [
    ['보낸 메시지', `${config.messages}건`],
    ['소비자가 받은 횟수', `${result.receives}번`],
    ['포인트 지급', `${result.grants}번`],
    ['두 번 이상 지급', `${result.doubleGranted}건`],
    ['ack 로 완료', `${result.acked}건`],
    ['DLQ 로 간 메시지', `${result.dead}건`],
  ];

  return (
    <div className="mq-lab">
      <RadioGroup
        label="시작 시나리오"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choose}
      />

      <div className="mq-lab__controls">
        <fieldset className="mq-lab__group">
          <legend>큐와 소비자</legend>
          <label className="mq-lab__range">
            <span>메시지 {config.messages}건</span>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={config.messages}
              onChange={(e) => update({ messages: Number(e.target.value) })}
            />
          </label>
          <label className="mq-lab__range">
            <span>처리 실패율 {config.failPercent}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={config.failPercent}
              onChange={(e) => update({ failPercent: Number(e.target.value) })}
            />
          </label>
          <label className="mq-lab__range">
            <span>ack 유실율 {config.ackLossPercent}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={25}
              value={config.ackLossPercent}
              onChange={(e) => update({ ackLossPercent: Number(e.target.value) })}
            />
          </label>
          <label className="mq-lab__range">
            <span>재시도 한도 (받을 수 있는 횟수) {config.maxReceives}번</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={config.maxReceives}
              onChange={(e) => update({ maxReceives: Number(e.target.value) })}
            />
          </label>
          <div className="mq-lab__dice">
            <span>주사위 {config.seed}</span>
            <Button variant="ghost" size="sm" onClick={() => update({ seed: config.seed + 1 })}>
              주사위 다시 굴리기
            </Button>
          </div>
        </fieldset>

        <fieldset className="mq-lab__group">
          <legend>재시도와 소비자 처리</legend>
          <RadioGroup
            label="재시도 간격"
            options={BACKOFF_OPTIONS}
            value={config.backoff}
            onValueChange={(v) => update({ backoff: v })}
          />
          <Checkbox
            label="멱등 처리 (처리한 메시지 ID 를 기록하고, 같은 ID 는 건너뛰어요)"
            checked={config.idempotent}
            onCheckedChange={(v) => update({ idempotent: v === true })}
          />
        </fieldset>
      </div>

      <section className="mq-lab__result" aria-labelledby="mq-result-title">
        <h3 id="mq-result-title">결과</h3>
        <dl className="mq-stats">
          {stats.map(([label, value]) => (
            <div className="mq-stat" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div aria-live="polite">
          <Alert tone={verdict.tone} title={verdict.title} />
        </div>
      </section>

      <section className="mq-lab__timeline" aria-labelledby="mq-timeline-title">
        <h3 id="mq-timeline-title">타임라인</h3>
        <label className="mq-lab__range">
          <span>
            {shown} / {total} 단계 보기
          </span>
          <input type="range" min={0} max={total} value={shown} onChange={(e) => setCut(Number(e.target.value))} />
        </label>
        <ol className="mq-timeline">
          {result.events.slice(0, shown).map((e, i) => (
            <li className="mq-timeline__item" data-lane={e.lane} key={i}>
              <span className="mq-timeline__t">틱 {e.t}</span>
              <Tag variant={LANE_TAG[e.lane]}>{LANE_LABEL[e.lane]}</Tag>
              <span className="mq-timeline__text">{e.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
