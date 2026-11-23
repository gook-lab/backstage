import { Alert, Checkbox, RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  HORIZON,
  MODE_LABEL,
  OP_LABEL,
  PRESETS,
  REINDEX_TAKES,
  VALUE_LABEL,
  dbValueAt,
  simulate,
  verdictOf,
  type Config,
  type Mode,
  type Op,
} from './model';
import './Simulator.css';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'dual-write', label: MODE_LABEL['dual-write'] + ' (앱이 DB 저장 뒤 색인을 직접 써요)' },
  { value: 'outbox', label: MODE_LABEL.outbox + ' (같은 트랜잭션에 발행할 행을 남겨요)' },
  { value: 'cdc', label: MODE_LABEL.cdc + ' (DB 변경 로그를 읽어 색인에 흘려요)' },
];

const OP_OPTIONS: { value: Op; label: string }[] = [
  { value: 'rename', label: OP_LABEL.rename },
  { value: 'delete', label: OP_LABEL.delete },
];

const REFRESH_OPTIONS = [
  { value: '1', label: '1초 (기본값)' },
  { value: '5', label: '5초' },
  { value: '30', label: '30초' },
];

/** 타임라인 한 칸은 2초 */
const BUCKET = 2;

export default function Simulator() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [config, setConfig] = useState<Config>(PRESETS[0].config);

  const outcome = useMemo(() => simulate(config), [config]);
  const verdict = verdictOf(config, outcome);

  const update = (patch: Partial<Config>) => {
    setPresetId('');
    setConfig((current) => ({ ...current, ...patch }));
  };

  const choose = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const finalDb = VALUE_LABEL[dbValueAt(config, 0)];
  const searchAtEnd = VALUE_LABEL[outcome.series[outcome.series.length - 1].search];
  const stats: [string, string][] = [
    ['DB 에 저장된 값', finalDb],
    [`${HORIZON}초 뒤 검색 결과`, searchAtEnd],
    ['색인 쓰기 시도', `${outcome.attempts.length}번`],
    ['같아지는 시각', outcome.syncedFrom === null ? '같아지지 않아요' : `${outcome.syncedFrom}초`],
  ];

  const events: string[] = [];
  events.push(
    config.mode === 'dual-write'
      ? '0초: DB 에 저장하고, 앱이 색인 쓰기를 바로 시도해요.'
      : config.mode === 'outbox'
        ? '0초: DB 에 저장하고, 같은 트랜잭션에 발행할 행을 남겨요.'
        : '0초: DB 에 저장하고, 변경 로그에 기록이 남아요.',
  );
  outcome.attempts.forEach((a, i) => {
    events.push(`${a.at}초: 색인 쓰기 ${i + 1}번째 ${a.ok ? '성공' : '실패'}.`);
  });
  outcome.visible.forEach((e) => {
    events.push(
      e.kind === 'write'
        ? `${e.at}초: refresh 뒤 검색에 ${VALUE_LABEL[e.value]} 이 보여요.`
        : `${e.at}초: 새 인덱스로 별칭을 바꿔서 검색에 ${VALUE_LABEL[e.value]} 이 보여요.`,
    );
  });
  if (config.reindexAt !== null) {
    events.push(`${config.reindexAt}초: 전체 재색인을 시작해요. ${REINDEX_TAKES}초쯤 걸린다고 가정해요.`);
  }

  return (
    <div className="si-lab">
      <RadioGroup
        label="시작 시나리오"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choose}
      />

      <div className="si-lab__controls">
        <fieldset className="si-lab__group">
          <legend>쓰기 경로</legend>
          <RadioGroup
            label="갱신 방식"
            options={MODE_OPTIONS}
            value={config.mode}
            onValueChange={(v) => update({ mode: v })}
          />
          <RadioGroup
            label="저장한 작업"
            options={OP_OPTIONS}
            value={config.op}
            onValueChange={(v) => update({ op: v })}
          />
        </fieldset>

        <fieldset className="si-lab__group">
          <legend>지연과 refresh</legend>
          <label className="si-lab__range">
            <span>
              발행 · 캡처 지연 {config.delay}초{config.mode === 'dual-write' ? ' (이중 쓰기에서는 쓰이지 않아요)' : ''}
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={config.delay}
              disabled={config.mode === 'dual-write'}
              onChange={(e) => update({ delay: Number(e.target.value) })}
            />
          </label>
          <RadioGroup
            label="색인 refresh 간격"
            options={REFRESH_OPTIONS}
            value={String(config.refresh)}
            onValueChange={(v) => update({ refresh: Number(v) })}
          />
        </fieldset>

        <fieldset className="si-lab__group">
          <legend>실패와 복구</legend>
          <label className="si-lab__range">
            <span>색인 쓰기 실패 {config.failCount}번</span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={config.failCount}
              onChange={(e) => update({ failCount: Number(e.target.value) })}
            />
          </label>
          <Checkbox
            label="실패하면 5초 간격으로 다시 시도해요"
            checked={config.retry}
            onCheckedChange={(v) => update({ retry: v === true })}
          />
          <Checkbox
            label="60초에 전체 재색인을 시작하고 별칭을 바꿔요"
            checked={config.reindexAt !== null}
            onCheckedChange={(v) => update({ reindexAt: v === true ? 60 : null })}
          />
        </fieldset>
      </div>

      <section className="si-lab__result" aria-labelledby="si-result-title">
        <h3 id="si-result-title">결과</h3>
        <dl className="si-stats">
          {stats.map(([label, value]) => (
            <div className="si-stat" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div aria-live="polite">
          <Alert tone={verdict.tone} title={verdict.title} />
          <p className="si-lab__reason">{verdict.reason}</p>
        </div>
      </section>

      <section className="si-lab__timeline" aria-labelledby="si-timeline-title">
        <h3 id="si-timeline-title">시간 축</h3>
        <p className="si-lab__legend">
          <span className="si-cell si-cell--same" aria-hidden="true" /> DB 와 검색 결과가 같아요{' '}
          <span className="si-cell si-cell--diff" aria-hidden="true" /> 달라요 (2초 칸, 0~{HORIZON}초)
        </p>
        <div
          className="si-bar"
          role="img"
          aria-label={
            outcome.syncedFrom === null
              ? `${HORIZON}초 동안 검색 결과가 끝까지 DB 와 달라요`
              : `${outcome.syncedFrom}초부터 검색 결과가 DB 와 같아요`
          }
        >
          {Array.from({ length: HORIZON / BUCKET }, (_, i) => {
            const point = outcome.series[i * BUCKET];
            return (
              <span
                key={i}
                className={point.same ? 'si-cell si-cell--same' : 'si-cell si-cell--diff'}
                title={`${point.t}초: DB ${VALUE_LABEL[point.db]} · 검색 ${VALUE_LABEL[point.search]}`}
              />
            );
          })}
        </div>
        <ol className="si-events">
          {events.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
        <p className="si-lab__note">수치는 감을 잡기 위한 예시예요.</p>
      </section>
    </div>
  );
}
