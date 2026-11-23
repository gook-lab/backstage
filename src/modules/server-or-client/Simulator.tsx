import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { moduleById } from '..';
import { useState } from 'react';
import { type Answers, DEFAULT_ANSWERS, type DataSize, decide, PRESETS, type Verdict, VERDICT_LABEL } from './model';
import './Simulator.css';

type FlagKey = { [K in keyof Answers]: Answers[K] extends boolean ? K : never }[keyof Answers];

const FLAGS: readonly { key: FlagKey; label: string; hint: string }[] = [
  {
    key: 'sensitive',
    label: '돈·권한·재고와 관련 있나요?',
    hint: '결제 금액, 접근 권한, 남은 수량처럼 틀리면 손해가 나는 값이에요.',
  },
  {
    key: 'shared',
    label: '다른 사람이 동시에 바꾸나요?',
    hint: '좌석, 재고, 좋아요 수처럼 여러 사람이 같은 값을 바꿔요.',
  },
  {
    key: 'instant',
    label: '즉각 반응이 필요한가요?',
    hint: '입력하거나 누를 때 바로 보여야 하면 켜 주세요.',
  },
  {
    key: 'heavy',
    label: '계산이 무거운가요?',
    hint: '집계, 대량 정렬, 압축처럼 기기에서 오래 걸리는 계산이에요.',
  },
  {
    key: 'secret',
    label: '비밀 규칙이 있나요?',
    hint: '할인 조건이나 위험 점수처럼 사용자에게 보이면 안 되는 규칙이에요.',
  },
  {
    key: 'offline',
    label: '오프라인에서도 돼야 하나요?',
    hint: '네트워크가 끊겨도 기능이 이어져야 하면 켜 주세요.',
  },
];

const SIZE_OPTIONS: readonly { value: DataSize; label: string }[] = [
  { value: 'small', label: '50건 안팎 · 이미 받아 둔 목록' },
  { value: 'medium', label: '수천 건' },
  { value: 'large', label: '50만 건 이상 · 서버에만 있어요' },
];

const VERDICT_HINT: Record<Verdict, string> = {
  server: '값의 진실을 서버가 쥐고 있어야 해요. 화면은 서버 응답을 그대로 보여 줘요.',
  client: '이미 가진 데이터로 기기에서 바로 계산해도 안전해요.',
  both: '클라이언트는 빠르게 미리 보여 주고, 서버 응답으로 최종 값을 맞춰요.',
};

export default function Simulator() {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [presetId, setPresetId] = useState('');

  const update = (patch: Partial<Answers>) => {
    setPresetId('');
    setAnswers((prev) => ({ ...prev, ...patch }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setAnswers(preset.answers);
  };

  const setFlag = (key: FlagKey, on: boolean) => update({ [key]: on } as Pick<Answers, FlagKey>);

  const { verdict, reasons, modules } = decide(answers);

  return (
    <div className="sc-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="sc-lab__questions">
        {FLAGS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            hint={f.hint}
            checked={answers[f.key]}
            onCheckedChange={(checked) => setFlag(f.key, checked === true)}
          />
        ))}
      </div>

      <div className="sc-lab__size">
        <RadioGroup
          label="데이터가 몇 건인가요?"
          options={SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={answers.dataSize}
          onValueChange={(v) => update({ dataSize: v })}
        />
        <p className="sc-lab__hint">건수는 판단을 돕는 예시예요. 기준은 서비스와 기기에 따라 달라요.</p>
      </div>

      <section className="sc-lab__result" aria-label="추천">
        <p className="sc-lab__verdict" data-verdict={verdict}>
          {VERDICT_LABEL[verdict]}
        </p>
        <p className="sc-lab__hint">{VERDICT_HINT[verdict]}</p>

        {reasons.length === 0 ? (
          <p className="sc-lab__hint">걸린 판단 기준이 없어요.</p>
        ) : (
          <ol className="sc-lab__reasons">
            {reasons.map((r) => (
              <li key={r.id}>{r.reason}</li>
            ))}
          </ol>
        )}

        {modules.length > 0 && (
          <div className="sc-lab__links-block">
            <h3>이어서 읽을 글</h3>
            <ul className="sc-lab__links">
              {modules.map((id) => (
                <li key={id}>
                  <a href={`/m/${id}`}>{moduleById(id)?.title ?? id}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
