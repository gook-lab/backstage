import { Button, Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import { MAX_REQUESTS, PRESETS, type Options, simulate, type Strategy } from './model';
import './Simulator.css';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'each', label: '요청마다 각자 갱신' },
  { value: 'shared', label: '하나로 묶어 갱신' },
];

const INITIAL: Omit<Options, 'requests'> = {
  strategy: 'each',
  rotation: false,
  reuseDetection: false,
  seed: 1,
};

export default function Simulator() {
  const [requests, setRequests] = useState(4);
  const [settings, setSettings] = useState<Omit<Options, 'requests'>>(INITIAL);
  const [presetId, setPresetId] = useState('');

  const update = (patch: Partial<Omit<Options, 'requests'>>) => {
    setPresetId('');
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setSettings((prev) => ({ ...prev, ...preset.options }));
  };

  const result = simulate({ ...settings, requests });

  const verdict = result.sessionEnded
    ? '세션이 끊겨서 로그아웃돼요'
    : result.requestsFailed > 0
      ? `요청 ${result.requestsFailed}개가 실패해요`
      : '모든 요청이 성공해요';

  return (
    <div className="ats-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="ats-lab__controls">
        <RadioGroup
          label="갱신을 어떻게 할까요?"
          options={STRATEGY_OPTIONS}
          value={settings.strategy}
          onValueChange={(v) => update({ strategy: v })}
        />

        <Checkbox
          label="리프레시 토큰을 회전해요"
          hint="갱신할 때마다 새 토큰을 주고 옛 토큰을 무효화해요."
          checked={settings.rotation}
          onCheckedChange={(checked) => update({ rotation: checked === true })}
        />

        <Checkbox
          label="무효화된 토큰이 다시 오면 세션을 끊어요"
          hint="회전을 켰을 때만 의미가 있어요. 재사용 감지라고 불러요."
          checked={settings.reuseDetection}
          disabled={!settings.rotation}
          onCheckedChange={(checked) => update({ reuseDetection: checked === true })}
        />

        <label className="ats-lab__range">
          <span>
            동시에 나간 요청 수 <strong>{requests}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={MAX_REQUESTS}
            step={1}
            value={requests}
            onChange={(e) => {
              setPresetId('');
              setRequests(Number(e.target.value));
            }}
          />
        </label>

        <div className="ats-lab__timing">
          <Button variant="secondary" size="sm" onClick={() => update({ seed: settings.seed + 1 })}>
            다른 타이밍으로 보기
          </Button>
          <span className="ats-lab__hint">응답이 돌아오는 순서가 바뀌어요. 같은 타이밍이면 결과도 같아요.</span>
        </div>
      </div>

      <section className="ats-lab__result" aria-label="갱신 결과">
        <p className="ats-lab__verdict" data-ended={result.sessionEnded}>
          {verdict}
        </p>

        <dl className="ats-lab__stats">
          <div>
            <dt>갱신 요청</dt>
            <dd>{result.refreshCalls}번</dd>
          </div>
          <div>
            <dt>갱신 성공</dt>
            <dd>{result.refreshOk}번</dd>
          </div>
          <div>
            <dt>옛 토큰 제출</dt>
            <dd>{result.staleTokens}번</dd>
          </div>
          <div>
            <dt>원래 요청</dt>
            <dd>
              성공 {result.requestsOk} · 실패 {result.requestsFailed}
            </dd>
          </div>
          <div>
            <dt>세션</dt>
            <dd>{result.sessionEnded ? '강제 종료' : '유지'}</dd>
          </div>
        </dl>

        <div className="ats-lab__log-block">
          <h3>시간 순서 로그</h3>
          <ol className="ats-lab__log">
            {result.log.map((line, idx) => (
              <li key={`${line.t}-${idx}`}>
                <span className="ats-lab__time">{line.t}ms</span> {line.text}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
