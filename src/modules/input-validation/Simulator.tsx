import { Alert, Checkbox, Input, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type ClientMode,
  DEFAULT_CLIENT,
  DEFAULT_RULES,
  judgeClient,
  judgeServer,
  measure,
  PRESETS,
  RELATION_TEXT,
  relate,
  reply,
  type Rules,
  UNIT_LABEL,
  UNITS,
} from './model';
import './Simulator.css';

const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }));

const CLIENT_OPTIONS: { value: ClientMode; label: string }[] = [
  { value: 'browser', label: '브라우저 기본 (maxlength, UTF-16)' },
  { value: 'spec', label: '서버와 같은 규칙' },
];

const STATUS_TEXT: Record<201 | 409 | 422, string> = {
  201: '저장돼요 (201)',
  409: '이미 쓰는 값이에요 (409)',
  422: '필드 값이 규칙을 어겼어요 (422)',
};

export default function Simulator() {
  const [text, setText] = useState(PRESETS.find((p) => p.id === 'family')!.text);
  const [presetId, setPresetId] = useState('family');
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [client, setClient] = useState<ClientMode>(DEFAULT_CLIENT);
  const [taken, setTaken] = useState(false);

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setText(preset.text);
  };

  const patch = (next: Partial<Rules>) => setRules((prev) => ({ ...prev, ...next }));

  const raw = measure(text);
  const clientJudge = judgeClient(text, rules, client);
  const serverJudge = judgeServer(text, rules);
  const relation = relate(clientJudge, serverJudge);
  const res = reply(text, rules, taken);
  const copy = RELATION_TEXT[relation];

  return (
    <div className="vi-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <Input
        label="닉네임"
        value={text}
        onChange={(e) => {
          setPresetId('');
          setText(e.target.value);
        }}
        helper="예시를 고르거나 직접 입력해 보세요."
      />

      <div className="vi-lab__rules">
        <label className="vi-lab__range">
          <span>최대 길이 · {rules.maxLength}</span>
          <input
            type="range"
            min={1}
            max={20}
            value={rules.maxLength}
            onChange={(e) => patch({ maxLength: Number(e.target.value) })}
          />
        </label>

        <RadioGroup
          label="길이를 세는 단위"
          options={UNIT_OPTIONS}
          value={rules.unit}
          onValueChange={(v) => patch({ unit: v })}
        />

        <Checkbox
          label="서버가 NFC로 정규화해요"
          checked={rules.normalize}
          onCheckedChange={(checked) => patch({ normalize: checked === true })}
        />
        <Checkbox
          label="서버가 앞뒤 공백을 떼요"
          checked={rules.trim}
          onCheckedChange={(checked) => patch({ trim: checked === true })}
        />
        <Checkbox
          label="이미 쓰는 닉네임이에요 (서버만 알아요)"
          checked={taken}
          onCheckedChange={(checked) => setTaken(checked === true)}
        />

        <RadioGroup label="화면 구현" options={CLIENT_OPTIONS} value={client} onValueChange={(v) => setClient(v)} />
      </div>

      <div className="vi-lab__stats">
        <Stat label="입력 UTF-16 유닛" value={raw.utf16} />
        <Stat label="입력 코드 포인트" value={raw.codepoint} />
        <Stat label="입력 UTF-8 바이트" value={raw.utf8} />
      </div>
      <p className="vi-lab__hint">길이는 입력값을 실제로 센 값이에요.</p>

      <section className="vi-lab__result" aria-label="판정">
        <div className="vi-lab__panel" data-side="client">
          <h3>화면 판정</h3>
          <p>
            <Tag>{clientJudge.ok ? '통과' : '막음'}</Tag> {clientJudge.length} {UNIT_LABEL[clientJudge.unit]}
          </p>
          <p className="vi-lab__hint">
            {client === 'browser'
              ? '브라우저 기본은 UTF-16 으로 세고, 정규화와 트림을 하지 않아요.'
              : '서버와 같은 규칙으로 세요.'}
          </p>
        </div>

        <div className="vi-lab__panel" data-side="server">
          <h3>서버 판정</h3>
          <p>
            <Tag>{serverJudge.ok ? '통과' : '거절'}</Tag> {serverJudge.length} {UNIT_LABEL[rules.unit]}
          </p>
          <p className="vi-lab__hint">
            저장될 값: <code>{JSON.stringify(serverJudge.stored)}</code>
          </p>
          <p className="vi-lab__status">{STATUS_TEXT[res.status]}</p>
          {res.problems.length > 0 && (
            <ul className="vi-lab__problems">
              {res.problems.map((p) => (
                <li key={`${p.pointer}-${p.detail}`}>
                  <code>{p.pointer}</code> {p.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Alert tone={copy.tone} title={copy.title}>
        {copy.body}
      </Alert>
    </div>
  );
}
