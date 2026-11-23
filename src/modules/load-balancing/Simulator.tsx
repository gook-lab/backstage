import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useId, useState } from 'react';
import { DEPLOY_AT, HORIZON, type Params, PRESETS, simulate, type Status, type Timeline } from './model';
import './Simulator.css';

const RANGES: readonly {
  key: Exclude<keyof Params, 'graceful'>;
  label: string;
  unit: string;
  min: number;
  max: number;
  hint: string;
}[] = [
  { key: 'servers', label: '서버 수', unit: '대', min: 1, max: 4, hint: '교체 대상 서버를 포함한 옛 서버 수예요.' },
  {
    key: 'healthIntervalSec',
    label: '헬스 체크 간격',
    unit: '초',
    min: 5,
    max: 30,
    hint: '로드밸런서가 서버를 확인하는 간격이에요. 연속 2번 실패하면 목록에서 빼요.',
  },
  {
    key: 'preStopSec',
    label: '종료 신호 전 대기',
    unit: '초',
    min: 0,
    max: 30,
    hint: '배포가 시작된 뒤 SIGTERM을 보내기까지 기다려요. 그동안 서버는 평소처럼 응답해요.',
  },
  {
    key: 'stopGraceSec',
    label: '종료 대기 시간',
    unit: '초',
    min: 0,
    max: 60,
    hint: 'SIGTERM 뒤 진행 중 요청을 기다리는 시간이에요. 마무리 옵션을 끄면 쓰지 않아요.',
  },
  {
    key: 'drainSec',
    label: '드레이닝 시간',
    unit: '초',
    min: 0,
    max: 60,
    hint: '목록에서 뺀 뒤 로드밸런서가 처리 중 요청을 기다려 주는 시간이에요.',
  },
  {
    key: 'requestSec',
    label: '요청 처리 시간',
    unit: '초',
    min: 1,
    max: 20,
    hint: '요청 하나가 서버에서 걸리는 시간이에요.',
  },
];

const STATUS_LABEL: Record<Status, string> = {
  200: '200 정상',
  502: '502 연결 실패 · 끊김',
  503: '503 거절',
};

const MARKERS = (t: Timeline) => [
  { at: DEPLOY_AT, label: `배포 시작 ${DEPLOY_AT}초` },
  { at: t.termAt, label: `종료 신호 ${t.termAt}초` },
  { at: t.noticeAt, label: `로드밸런서가 목록에서 뺌 ${t.noticeAt}초` },
  { at: t.exitAt, label: `프로세스 종료 ${t.exitAt}초` },
];

function Range({
  label,
  unit,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  return (
    <div className="lb-lab__range">
      <label htmlFor={id}>
        {label}{' '}
        <output>
          {value}
          {unit}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="lb-lab__hint">{hint}</p>
    </div>
  );
}

export default function Simulator() {
  const [params, setParams] = useState<Params>(PRESETS[0].params);
  const [presetId, setPresetId] = useState(PRESETS[0].id);

  const update = (patch: Partial<Params>) => {
    setPresetId('');
    setParams((prev) => ({ ...prev, ...patch }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setParams(preset.params);
  };

  const t = simulate(params);
  const failures = t.shots.filter((s) => s.status !== 200);
  const first = failures[0];
  const last = failures.at(-1);

  return (
    <div className="lb-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="lb-lab__controls">
        {RANGES.map((r) => (
          <Range
            key={r.key}
            label={r.label}
            unit={r.unit}
            hint={r.hint}
            value={params[r.key]}
            min={r.min}
            max={r.max}
            onChange={(next) => update({ [r.key]: next } as Partial<Params>)}
          />
        ))}
      </div>

      <Checkbox
        label="SIGTERM 뒤 마무리하고 종료"
        hint="켜면 종료 신호를 받은 서버가 새 요청을 503으로 거절하고, 진행 중 요청을 끝까지 기다려요. 끄면 신호와 함께 바로 내려가요."
        checked={params.graceful}
        onCheckedChange={(checked) => update({ graceful: checked === true })}
      />

      <section className="lb-lab__timeline" aria-label="배포 타임라인">
        <div className="lb-lab__axis">
          <span />
          <div className="lb-lab__track">
            {Array.from({ length: HORIZON / 10 + 1 }, (_, i) => i * 10).map((sec) => (
              <span key={sec} className="lb-lab__tick" style={{ left: `${(sec / HORIZON) * 100}%` }}>
                {sec}초
              </span>
            ))}
          </div>
        </div>

        {t.lanes.map((lane, laneIndex) => (
          <div key={lane.label} className="lb-lab__lane" data-replaced={lane.replaced || undefined}>
            <span className="lb-lab__lane-label">{lane.label}</span>
            <div className="lb-lab__track">
              {MARKERS(t)
                .filter((m) => m.at <= HORIZON)
                .map((m) => (
                  <span key={m.label} className="lb-lab__marker" style={{ left: `${(m.at / HORIZON) * 100}%` }} />
                ))}
              {t.shots
                .filter((s) => s.lane === laneIndex)
                .map((s) => (
                  <span
                    key={s.id}
                    className="lb-lab__dot"
                    data-status={s.status}
                    style={{ left: `${(s.at / HORIZON) * 100}%` }}
                    title={`${s.at.toFixed(1)}초 · ${STATUS_LABEL[s.status]} · ${s.reason}`}
                  />
                ))}
            </div>
          </div>
        ))}

        <ul className="lb-lab__legend">
          {MARKERS(t).map((m) => (
            <li key={m.label}>{m.label}</li>
          ))}
        </ul>
      </section>

      <section className="lb-lab__result" aria-label="결과">
        <p className="lb-lab__counts">
          200 {t.counts[200]}개 · 502 {t.counts[502]}개 · 503 {t.counts[503]}개
        </p>
        {!first || !last ? (
          <p className="lb-lab__hint">배포 중 실패 응답이 없어요. 모든 요청이 정상 응답을 받았어요.</p>
        ) : (
          <>
            <p className="lb-lab__hint">
              첫 실패는 {first.at.toFixed(1)}초, 마지막 실패는 {last.at.toFixed(1)}초에 나왔어요.
            </p>
            <p className="lb-lab__hint">첫 실패 원인: {first.reason}</p>
          </>
        )}
        <p className="lb-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
      </section>
    </div>
  );
}
