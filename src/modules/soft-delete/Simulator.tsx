import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Answers,
  CASCADE_LABEL,
  type Cascade,
  DEFAULT_ANSWERS,
  decide,
  GUARD_LABEL,
  type Guard,
  METHOD_LABEL,
  type Method,
  relevantControls,
  SCENARIO_LABEL,
  type Scenario,
} from './model';
import './Simulator.css';

const METHODS = Object.keys(METHOD_LABEL) as Method[];
const SCENARIOS = Object.keys(SCENARIO_LABEL) as Scenario[];
const GUARDS = Object.keys(GUARD_LABEL) as Guard[];
const CASCADES = Object.keys(CASCADE_LABEL) as Cascade[];

const VERDICT_LABEL = {
  ok: '기대한 결과예요',
  fail: '요청이 실패해요',
  leak: '지운 데이터가 남거나 보여요',
} as const;

export default function Simulator() {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const update = (patch: Partial<Answers>) => setAnswers((prev) => ({ ...prev, ...patch }));

  const outcome = decide(answers);
  const relevant = relevantControls(answers.scenario);

  return (
    <div className="sd-lab">
      <RadioGroup
        label="삭제 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={answers.method}
        onValueChange={(v) => update({ method: v as Method })}
      />

      <RadioGroup
        label="일어난 사건"
        options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))}
        value={answers.scenario}
        onValueChange={(v) => update({ scenario: v as Scenario })}
      />

      <div className="sd-lab__controls">
        <div className="sd-lab__control" data-active={relevant.guard}>
          <RadioGroup
            label="조회 방식"
            options={GUARDS.map((g) => ({ value: g, label: GUARD_LABEL[g] }))}
            value={answers.guard}
            onValueChange={(v) => update({ guard: v as Guard })}
          />
          {!relevant.guard && <p className="sd-lab__hint">이 사건에서는 조회 방식이 결과를 바꾸지 않아요.</p>}
        </div>

        <div className="sd-lab__control" data-active={relevant.cascade}>
          <RadioGroup
            label="댓글 외래 키 (ON DELETE)"
            options={CASCADES.map((c) => ({ value: c, label: CASCADE_LABEL[c] }))}
            value={answers.cascade}
            onValueChange={(v) => update({ cascade: v as Cascade })}
          />
          {!relevant.cascade && (
            <p className="sd-lab__hint">댓글 사건에서만 쓰여요. 소프트 삭제는 행을 지우지 않아서 실행되지 않아요.</p>
          )}
        </div>
      </div>

      <section className="sd-lab__result" aria-label="결과">
        <p className="sd-lab__verdict" data-verdict={outcome.verdict}>
          {VERDICT_LABEL[outcome.verdict]}
        </p>
        <p className="sd-lab__status">
          HTTP <strong>{outcome.status}</strong> · {outcome.headline}
        </p>
        <p className="sd-lab__hint">{outcome.reason}</p>
        {outcome.warn && <p className="sd-lab__warn">{outcome.warn}</p>}
      </section>

      <p className="sd-lab__hint">기간과 댓글 규칙은 예시예요. 실제 값은 서비스 정책에 따라 정해요.</p>
    </div>
  );
}
