import { Alert, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  COMPILE_NOTE,
  DETECT_LABEL,
  SCENARIOS,
  SPEC_JSON,
  STRATEGIES,
  type Scenario,
  type Strategy,
  screenFor,
  serverBody,
} from './model';
import './Simulator.css';

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('assert');
  const [scenario, setScenario] = useState<Scenario>('rename');

  const screen = screenFor(strategy, scenario);
  const strategyInfo = STRATEGIES.find((s) => s.id === strategy);
  const scenarioInfo = SCENARIOS.find((s) => s.id === scenario);
  const alertTone =
    screen.detect === 'none'
      ? 'success'
      : screen.detect === 'handled'
        ? 'info'
        : screen.detect === 'silent'
          ? 'warning'
          : 'error';

  return (
    <section className="ac" aria-labelledby="ac-title">
      <h3 id="ac-title" className="ac-title">
        API 계약 시뮬레이터
      </h3>
      <p className="ac-hint">
        명세 하나를 두고, 서버 응답이 바뀌었을 때 FE 처리 방식에 따라 오류가 어디서 드러나는지 봐요.
      </p>

      <div className="ac-controls">
        <RadioGroup
          label="FE 처리 방식"
          options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))}
          value={strategy}
          onValueChange={(value) => setStrategy(value as Strategy)}
        />
        <p className="ac-hint">{strategyInfo?.summary}</p>

        <RadioGroup
          label="서버 응답 변화"
          options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
          value={scenario}
          onValueChange={(value) => setScenario(value as Scenario)}
        />
        <p className="ac-hint">{scenarioInfo?.summary}</p>
      </div>

      <div className="ac-grid">
        <div className="ac-block">
          <p className="ac-label" id="ac-spec-label">
            계약 명세 (JSON Schema 일부)
          </p>
          <pre className="ac-code" aria-labelledby="ac-spec-label">
            {SPEC_JSON}
          </pre>
        </div>
        <div className="ac-block">
          <p className="ac-label" id="ac-body-label">
            서버가 보낸 응답 본문
          </p>
          <pre className="ac-code" aria-labelledby="ac-body-label">
            {serverBody(scenario)}
          </pre>
        </div>
      </div>

      <Alert tone={alertTone} title={DETECT_LABEL[screen.detect]} />

      {screen.issues.length > 0 ? (
        <ul className="ac-issues" aria-label="계약 위반 목록">
          {screen.issues.map((issue) => (
            <li key={`${issue.path}-${issue.message}`}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {screen.notes.length > 0 ? (
        <ul className="ac-issues" aria-label="대체 처리 내역">
          {screen.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {screen.crash ? (
        <p className="ac-crash" role="alert">
          화면 오류: {screen.crash}
        </p>
      ) : null}

      <section className="ac-screen" aria-label="화면에 그려진 값">
        {screen.rows.length > 0 ? (
          <dl className="ac-rows">
            {screen.rows.map((row) => (
              <div className="ac-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ac-hint">
            {screen.detect === 'boundary' ? '계약 위반 때문에 값을 그리지 않았어요.' : '그려진 값이 없어요.'}
          </p>
        )}
      </section>

      <section className="ac-stats" aria-label="화면 결과">
        <Stat label="오류 감지 위치" value={DETECT_LABEL[screen.detect]} />
        <Stat label="계약 위반" value={screen.issues.length} unit="건" />
        <Stat label="화면에 그려진 칸" value={screen.rows.length} unit="칸" />
        <Stat label="컴파일 단계" value="안 드러남" />
      </section>

      <p className="ac-summary" aria-live="polite">
        {screen.summary}
      </p>
      <p className="ac-hint">{COMPILE_NOTE}</p>
      <p className="ac-foot">응답 값은 설명을 위한 예시예요.</p>
    </section>
  );
}
