import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Config,
  DEFAULT_CONFIG,
  DISPLAY_LABEL,
  type Display,
  type Event,
  EVENT_LABEL,
  effectiveDisplay,
  MIGRATION_DAYS,
  OVERLAP_LABEL,
  type Overlap,
  PRESETS,
  reasons,
  simulate,
  STORAGE_LABEL,
  type Storage,
  TRANSPORT_LABEL,
  type Transport,
} from './model';
import './Simulator.css';

const EVENT_IDS = Object.keys(EVENT_LABEL) as Event[];

export default function Simulator() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [presetId, setPresetId] = useState('mistake');
  const [event, setEvent] = useState<Event>('db-leak');

  const patch = (next: Partial<Config>) => {
    setPresetId('');
    setConfig((prev) => ({ ...prev, ...next }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const shown = effectiveDisplay(config);
  const outcome = simulate(config, event);
  const notes = reasons(config, event);

  return (
    <div className="ak-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="ak-lab__controls">
        <RadioGroup<Storage>
          label="저장 방식"
          options={(Object.keys(STORAGE_LABEL) as Storage[]).map((v) => ({ value: v, label: STORAGE_LABEL[v] }))}
          value={config.storage}
          onValueChange={(v) => patch({ storage: v })}
        />
        <RadioGroup<Transport>
          label="전달 방식"
          options={(Object.keys(TRANSPORT_LABEL) as Transport[]).map((v) => ({ value: v, label: TRANSPORT_LABEL[v] }))}
          value={config.transport}
          onValueChange={(v) => patch({ transport: v })}
        />
        <RadioGroup<Display>
          label="표시 방식"
          options={(Object.keys(DISPLAY_LABEL) as Display[]).map((v) => ({ value: v, label: DISPLAY_LABEL[v] }))}
          value={shown}
          onValueChange={(v) => patch({ display: v })}
        />
        <RadioGroup<Overlap>
          label="회전 겹침 기간"
          options={(Object.keys(OVERLAP_LABEL) as Overlap[]).map((v) => ({ value: v, label: OVERLAP_LABEL[v] }))}
          value={config.overlap}
          onValueChange={(v) => patch({ overlap: v })}
        />
      </div>

      <RadioGroup<Event>
        label="사건"
        options={EVENT_IDS.map((v) => ({ value: v, label: EVENT_LABEL[v] }))}
        value={event}
        onValueChange={setEvent}
      />

      <section className="ak-lab__result" aria-label="판정">
        <ul className="ak-lab__metrics">
          <li className="ak-lab__metric">
            <span className="ak-lab__metric-label">공격자가 쓸 수 있는 키 값</span>
            <span className="ak-lab__metric-value" data-leaks={outcome.attackerKeys > 0 ? 'yes' : 'no'}>
              {outcome.attackerKeys}개
            </span>
          </li>
          <li className="ak-lab__metric">
            <span className="ak-lab__metric-label">계정 화면에서 다시 볼 수 있는 키 값</span>
            <span className="ak-lab__metric-value">{outcome.revealable}개</span>
          </li>
          <li className="ak-lab__metric">
            <span className="ak-lab__metric-label">{`옮기는 ${MIGRATION_DAYS}일 동안 실패하는 정상 요청`}</span>
            <span className="ak-lab__metric-value" data-fail={outcome.failingLegit > 0 ? 'yes' : 'no'}>
              {outcome.failingLegit}개
            </span>
          </li>
        </ul>

        <ul className="ak-lab__notes">
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <p className="ak-lab__hint">수치는 감을 잡기 위한 예시예요. 실제 키 값을 넣지 마세요.</p>
      </section>
    </div>
  );
}
