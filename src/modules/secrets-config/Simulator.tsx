import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Choice,
  type Choices,
  DEFAULT_CHOICES,
  DEFAULT_TOOL,
  ITEMS,
  LEAK_STEPS,
  PLACEMENT_LABEL,
  PRESETS,
  type Placement,
  PREFIX,
  review,
  TOOLS,
  type Tool,
  VERDICT_HINT,
  VERDICT_LABEL,
} from './model';
import './Simulator.css';

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: 'build', label: PLACEMENT_LABEL.build },
  { value: 'server', label: PLACEMENT_LABEL.server },
  { value: 'vault', label: PLACEMENT_LABEL.vault },
];

export default function Simulator() {
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL);
  const [choices, setChoices] = useState<Choices>(DEFAULT_CHOICES);
  const [presetId, setPresetId] = useState('mistake');

  const setChoice = (id: string, patch: Partial<Choice>) => {
    setPresetId('');
    setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setTool(preset.tool);
    setChoices(preset.choices);
  };

  const { rows, leaks, bundleLines } = review(tool, choices);

  return (
    <div className="sx-lab">
      <RadioGroup
        label="빌드 도구"
        options={TOOLS.map((t) => ({ value: t.value, label: t.label }))}
        value={tool}
        onValueChange={(v) => {
          setPresetId('');
          setTool(v);
        }}
      />

      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="sx-lab__items">
        {ITEMS.map((item) => {
          const choice = choices[item.id];
          return (
            <div className="sx-lab__item" key={item.id}>
              <p className="sx-lab__item-head">
                <span className="sx-lab__item-name">{item.label}</span>
                <span className="sx-lab__kind" data-kind={item.kind}>
                  {item.kind === 'secret' ? '비밀' : '공개 가능'}
                </span>
              </p>
              <RadioGroup
                label={`${item.label} 위치`}
                options={PLACEMENT_OPTIONS}
                value={choice.placement}
                onValueChange={(v) => setChoice(item.id, { placement: v })}
              />
              <Checkbox
                label={`${item.label} 접두 붙이기`}
                hint={`붙이면 ${PREFIX[tool]}${item.base}, 빼면 ${item.base} 이름이 돼요.`}
                checked={choice.prefixed}
                onCheckedChange={(checked) => setChoice(item.id, { prefixed: checked === true })}
              />
            </div>
          );
        })}
      </div>

      <section className="sx-lab__result" aria-label="판정">
        <p className="sx-lab__verdict" data-leaks={leaks > 0 ? 'yes' : 'no'}>
          {leaks > 0 ? `비밀 값 ${leaks}개가 배포 번들에 들어가요.` : '배포 번들에 비밀 값이 없어요.'}
        </p>

        <div className="sx-lab__table-wrap">
          <table className="sx-lab__table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">번들 포함</th>
                <th scope="col">판정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.item.id}>
                  <td>
                    <code>{row.name}</code>
                  </td>
                  <td>{row.bundled ? '예' : '아니요'}</td>
                  <td>
                    <span className="sx-lab__badge" data-verdict={row.verdict}>
                      {VERDICT_LABEL[row.verdict]}
                    </span>
                    <span className="sx-lab__hint">{VERDICT_HINT[row.verdict]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sx-lab__bundle">
          <h3>배포 JS 에 들어가는 문자열 (예시 값)</h3>
          {bundleLines.length === 0 ? (
            <p className="sx-lab__hint">번들에 들어가는 값이 없어요.</p>
          ) : (
            <pre>{bundleLines.join('\n')}</pre>
          )}
        </div>

        {leaks > 0 && (
          <div className="sx-lab__steps">
            <h3>노출됐다면 할 일</h3>
            <ol>
              {LEAK_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <p className="sx-lab__hint">값과 이름은 모두 가짜 예시예요. 실제 키 값을 넣지 마세요.</p>
      </section>
    </div>
  );
}
