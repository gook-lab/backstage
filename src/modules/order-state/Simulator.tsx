import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ACTION_LABEL,
  ACTOR_LABEL,
  allowedActions,
  isValidTransition,
  MODE_LABEL,
  type Mode,
  type Request,
  run,
  SCENARIOS,
  STATUS_LABEL,
} from './model';
import './Simulator.css';

const MODE_HINT: Record<Mode, string> = {
  'ui-only': '버튼만 숨겨요. 서버는 요청이 오면 상태 규칙을 보지 않고 요청한 값을 그대로 써요.',
  'check-then-write':
    '서버가 현재 상태를 읽고 규칙을 확인한 뒤 써요. 같은 순간에 온 요청은 같은 옛 상태를 읽고 모두 통과해요.',
  conditional: '쓰기 조건에 기대하는 상태를 넣어요. 조건이 맞지 않으면 갱신 행이 0 이고 409 를 보내요.',
};

const MODES: readonly Mode[] = ['ui-only', 'check-then-write', 'conditional'];

function responseText(status: 200 | 409, ignored: boolean): string {
  if (status === 409) return '409 Conflict';
  return ignored ? '200 (무시)' : '200';
}

export default function Simulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[2].id);
  const [mode, setMode] = useState<Mode>('check-then-write');

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const result = run(scenario, mode);
  const requestById = new Map<string, Request>(scenario.requests.map((r) => [r.id, r]));
  const startActions = allowedActions(scenario.start).map((a) => ACTION_LABEL[a]);
  const finalActions = allowedActions(result.finalStatus).map((a) => ACTION_LABEL[a]);

  return (
    <div className="os-lab">
      <RadioGroup
        label="들어온 요청"
        options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
        value={scenarioId}
        onValueChange={setScenarioId}
      />
      <p className="os-lab__hint">
        시작 상태는 {STATUS_LABEL[scenario.start]}예요. 서버가 내려 준 동작은{' '}
        {startActions.length > 0 ? startActions.join(', ') : '없어요'}예요.
      </p>

      <RadioGroup
        label="판정 방식"
        options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        value={mode}
        onValueChange={setMode}
      />
      <p className="os-lab__hint">{MODE_HINT[mode]}</p>

      <section className="os-lab__results" aria-label="결과">
        <Stat label="최종 상태" value={STATUS_LABEL[result.finalStatus]} />
        <Stat
          label="잘못된 전이"
          value={result.wrongTransitions}
          unit="건"
          tone={result.wrongTransitions > 0 ? 'accent' : 'ink'}
        />
        <Stat label="기록된 변경" value={result.history.length} unit="건" />
      </section>

      {result.wrongTransitions > 0 && (
        <p className="os-lab__alarm" role="status">
          허용되지 않은 전이가 {result.wrongTransitions}건 기록됐어요. 지금 상태에서는 일어나면 안 되는 변경이에요.
        </p>
      )}

      <table className="os-table">
        <caption>요청별 응답</caption>
        <thead>
          <tr>
            <th scope="col">요청</th>
            <th scope="col">응답</th>
            <th scope="col">설명</th>
          </tr>
        </thead>
        <tbody>
          {result.responses.map((res) => {
            const req = requestById.get(res.requestId);
            const label = STATUS_LABEL[res.current];
            let explain = `${label} 상태로 바뀌었어요.`;
            if (res.status === 409) explain = `현재 상태는 ${label}예요. 이 동작은 허용되지 않아요.`;
            else if (res.ignored) explain = `이미 지난 상태라 버렸어요. 상태는 ${label} 그대로예요.`;
            return (
              <tr key={res.requestId}>
                <th scope="row">
                  {req?.label}
                  <small className="os-table__actor">{req ? ACTOR_LABEL[req.actor] : ''}</small>
                </th>
                <td>{responseText(res.status, res.ignored)}</td>
                <td>{explain}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="os-lab__history" aria-label="전이 이력">
        <h3>기록된 전이</h3>
        {result.history.length === 0 ? (
          <p className="os-lab__note">기록된 전이가 없어요. 상태는 시작 그대로예요.</p>
        ) : (
          <ol className="os-lab__list">
            {result.history.map((h, i) => {
              const valid = isValidTransition(h.from, h.to);
              return (
                <li key={`${h.requestId}-${i}`}>
                  <span>
                    {STATUS_LABEL[h.from]} → {STATUS_LABEL[h.to]}
                  </span>
                  <small>{requestById.get(h.requestId)?.label}</small>
                  {!valid && <Tag variant="accent">허용 안 됨</Tag>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="os-lab__note">
        최종 상태에서 화면에 그릴 버튼: {finalActions.length > 0 ? finalActions.join(', ') : '없음'}
      </p>
      <p className="os-lab__note">화면 상태는 예시로 돌려 본 결과예요. 실제 주문 데이터가 아니에요.</p>
    </div>
  );
}
