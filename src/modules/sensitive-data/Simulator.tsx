import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Analytics,
  type Answers,
  type AppLog,
  type Carrier,
  DEFAULT_ANSWERS,
  ITEM_LABEL,
  type Placement,
  PRESETS,
  type ReferrerPolicy,
  type Retention,
  type ResponseShape,
  responseFields,
  retentionDays,
  SAMPLE,
  summarize,
  VERDICT_LABEL,
} from './model';
import './Simulator.css';

const CARRIER_OPTIONS: { value: Carrier; label: string }[] = [
  { value: 'query', label: 'URL 쿼리' },
  { value: 'body', label: '요청 본문' },
  { value: 'header', label: '헤더' },
];

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: 'body', label: '요청 본문' },
  { value: 'query', label: 'URL 쿼리' },
  { value: 'header', label: '헤더' },
  { value: 'none', label: '보내지 않아요' },
];

const APP_LOG_OPTIONS: { value: AppLog; label: string }[] = [
  { value: 'raw', label: '원본 그대로' },
  { value: 'mask', label: '값만 가리기' },
  { value: 'allowlist', label: '허용한 필드만' },
];

const ANALYTICS_OPTIONS: { value: Analytics; label: string }[] = [
  { value: 'raw', label: '주소 전체 · 폼 값' },
  { value: 'designed', label: '경로 · 허용 속성만' },
];

const REFERRER_OPTIONS: { value: ReferrerPolicy; label: string }[] = [
  { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin (기본값)' },
  { value: 'unsafe-url', label: 'unsafe-url' },
  { value: 'no-referrer', label: 'no-referrer' },
];

const RETENTION_OPTIONS: { value: Retention; label: string }[] = [
  { value: 'short', label: '짧게 · 예시 7일' },
  { value: 'long', label: '길게 · 예시 365일' },
];

const RESPONSE_OPTIONS: { value: ResponseShape; label: string }[] = [
  { value: 'full', label: '사용자 객체 통째로' },
  { value: 'needed', label: '필요한 결과만' },
];

const ITEM_TEXT = (items: readonly string[]) => (items.length === 0 ? '남지 않아요' : items.join(' · '));

export default function Simulator() {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [presetId, setPresetId] = useState('query-default');

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

  const summary = summarize(answers);
  const days = retentionDays(answers);

  return (
    <div className="sd-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <fieldset className="sd-lab__group">
        <legend>요청 하나 — 값을 어디에 실을지</legend>
        <RadioGroup
          label={`${ITEM_LABEL.token} (${SAMPLE.token})`}
          options={CARRIER_OPTIONS}
          value={answers.token}
          onValueChange={(v) => update({ token: v as Carrier })}
        />
        <RadioGroup
          label={`이메일 (${SAMPLE.email})`}
          options={PLACEMENT_OPTIONS}
          value={answers.email}
          onValueChange={(v) => update({ email: v as Placement })}
        />
        <RadioGroup
          label={`카드 번호 (${SAMPLE.card})`}
          options={PLACEMENT_OPTIONS}
          value={answers.card}
          onValueChange={(v) => update({ card: v as Placement })}
        />
      </fieldset>

      <fieldset className="sd-lab__group">
        <legend>설정 — 저장소마다 정하는 방식</legend>
        <RadioGroup
          label="앱 로그"
          options={APP_LOG_OPTIONS}
          value={answers.appLog}
          onValueChange={(v) => update({ appLog: v as AppLog })}
        />
        <Checkbox
          label="에러 추적으로 보내기 전에 본문과 헤더 지우기"
          hint="주소의 쿼리는 이 설정으로 지워지지 않아요."
          checked={answers.errorScrub}
          onCheckedChange={(checked) => update({ errorScrub: checked === true })}
        />
        <RadioGroup
          label="분석 이벤트"
          options={ANALYTICS_OPTIONS}
          value={answers.analytics}
          onValueChange={(v) => update({ analytics: v as Analytics })}
        />
        <RadioGroup
          label="Referrer-Policy"
          options={REFERRER_OPTIONS}
          value={answers.referrer}
          onValueChange={(v) => update({ referrer: v as ReferrerPolicy })}
        />
        <RadioGroup
          label="로그 보존 기간"
          options={RETENTION_OPTIONS}
          value={answers.retention}
          onValueChange={(v) => update({ retention: v as Retention })}
        />
        <RadioGroup
          label="응답 필드"
          options={RESPONSE_OPTIONS}
          value={answers.response}
          onValueChange={(v) => update({ response: v as ResponseShape })}
        />
        <p className="sd-lab__hint">보존 기간 숫자는 예시예요. 실제 기간은 정책으로 정해요.</p>
      </fieldset>

      <section className="sd-lab__result" aria-label="저장소별 결과">
        <p className="sd-lab__verdict" data-verdict={summary.verdict}>
          {VERDICT_LABEL[summary.verdict]}
        </p>
        <p className="sd-lab__hint">토큰이 남는 저장소는 {summary.tokenStores}곳이에요.</p>

        <div className="sd-lab__table-wrap">
          <table className="sd-lab__table">
            <thead>
              <tr>
                <th scope="col">저장소</th>
                <th scope="col">남는 값</th>
                <th scope="col">이유</th>
              </tr>
            </thead>
            <tbody>
              {summary.stores.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    {s.label}
                    {s.kept ? <span className="sd-lab__kept"> · 보존 {days}일(예시)</span> : null}
                  </th>
                  <td data-empty={s.items.length === 0}>{ITEM_TEXT(s.items.map((i) => ITEM_LABEL[i]))}</td>
                  <td>{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sd-lab__response">
          <h3>응답에 실리는 필드 (예시)</h3>
          <p className="sd-lab__hint">{responseFields(answers).join(', ')}</p>
        </div>
      </section>
    </div>
  );
}
