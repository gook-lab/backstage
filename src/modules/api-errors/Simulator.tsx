import { Alert, Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type FieldName,
  SAMPLE_INPUT,
  SCENARIOS,
  STYLES,
  type ResponseStyle,
  type Scenario,
  screenFor,
  serverReply,
} from './model';
import './Simulator.css';

const FIELDS: FieldName[] = ['email', 'password', 'nickname'];

export default function Simulator() {
  const [style, setStyle] = useState<ResponseStyle>('problem-json');
  const [scenario, setScenario] = useState<Scenario>('fields');

  const screen = screenFor(style, scenario);
  const reply = serverReply(style, scenario);
  const styleInfo = STYLES.find((s) => s.id === style);
  const messageByField = new Map(screen.fieldErrors.map((e) => [e.field, e.message]));

  return (
    <section className="ae" aria-labelledby="ae-title">
      <h3 id="ae-title" className="ae-title">
        에러 응답 시뮬레이터
      </h3>
      <p className="ae-hint">
        같은 회원 가입 폼에 같은 실패가 일어났을 때, 서버 응답 모양에 따라 화면이 어떻게 달라지는지 봐요.
      </p>

      <div className="ae-controls">
        <RadioGroup
          label="서버가 에러를 보내는 방식"
          options={STYLES.map((s) => ({ value: s.id, label: s.label }))}
          value={style}
          onValueChange={(value) => setStyle(value as ResponseStyle)}
        />
        <p className="ae-hint">{styleInfo?.summary}</p>

        <RadioGroup
          label="서버에서 일어난 일"
          options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
          value={scenario}
          onValueChange={(value) => setScenario(value as Scenario)}
        />
      </div>

      <div className="ae-form" role="group" aria-label="회원 가입 예시 폼">
        {FIELDS.map((field) => {
          const id = `ae-${field}`;
          const errorId = `${id}-error`;
          const message = messageByField.get(field);
          return (
            <div className="ae-field" key={field}>
              <label htmlFor={id}>{SAMPLE_INPUT[field].label}</label>
              <input
                id={id}
                className="ae-input"
                readOnly
                value={SAMPLE_INPUT[field].value}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? errorId : undefined}
              />
              {message ? (
                <p id={errorId} className="ae-field__error">
                  {message}
                </p>
              ) : null}
            </div>
          );
        })}
        <p className="ae-hint">입력값은 고정된 예시예요. 칸 옆 오류 위치만 바뀌어요.</p>
      </div>

      {screen.banner ? <Alert tone="warning" title={screen.banner} /> : null}
      {screen.retryButton ? (
        <Button variant="secondary" size="sm">
          다시 시도
        </Button>
      ) : null}

      <section className="ae-stats" aria-label="화면 결과">
        <Stat label="서버 상태 코드" value={reply.status} />
        <Stat label="입력칸 옆 오류" value={screen.fieldErrors.length} unit="곳" />
        <Stat label="상단 메시지" value={screen.banner ? '있음' : '없음'} />
        <Stat label="재시도 버튼" value={screen.retryButton ? '보임' : '없음'} />
        <Stat label="문의용 요청 번호" value={screen.requestId ?? '없음'} />
      </section>

      <p className="ae-summary" aria-live="polite">
        {screen.summary}
      </p>

      <p className="ae-foot">수치는 감을 잡기 위한 예시예요.</p>
    </section>
  );
}
