import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  OUTCOME_LABEL,
  PAY_LABEL,
  type Params,
  SCENARIO_LABEL,
  SCENARIOS,
  type Scenario,
  WRITE_MODE_LABEL,
  WRITE_MODES,
  type WriteMode,
  simulate,
} from './model';
import './Simulator.css';

const MODE_HINT: Record<WriteMode, string> = {
  'check-then-write':
    '시작할 때 본 사용 기록과 수량으로 판단하고, 쓸 때는 다시 확인하지 않아요. 같은 틱의 요청은 같은 옛 값을 봐요.',
  guarded: '사용자당 한 행과 조건부 UPDATE로 확인과 차감을 한 번에 해요. 두 번째 요청은 앞선 요청의 결과를 봐요.',
};

const SCENARIO_HINT: Record<Scenario, string> = {
  'two-tabs': '같은 사용자가 같은 틱에 두 번 요청해요.',
  'payment-fail': '첫 결제가 실패해서 쿠폰이 풀리고, 다른 사용자가 이어서 받아요.',
  expire: '보류 시간이 지난 뒤 첫 사용자의 결제가 도착해요.',
  burst: '같은 틱에 10명이 같은 쿠폰을 요청해요.',
};

export default function Simulator() {
  const [mode, setMode] = useState<WriteMode>('guarded');
  const [scenario, setScenario] = useState<Scenario>('two-tabs');
  const [stock, setStock] = useState(1);
  const [ttl, setTtl] = useState(5);

  const params: Params = { mode, scenario, stock, ttl };
  const result = simulate(params);
  const hasViolation = result.remaining < 0 || result.duplicateUsers > 0;

  const alarms: string[] = [];
  if (result.remaining < 0) alarms.push(`재고보다 ${-result.remaining}장 많이 할인됐어요.`);
  if (result.duplicateUsers > 0) alarms.push(`같은 사용자가 쿠폰을 ${result.duplicateUsers}번 더 썼어요.`);

  return (
    <div className="cr-lab">
      <RadioGroup
        label="기록 방식"
        options={WRITE_MODES.map((m) => ({ value: m, label: WRITE_MODE_LABEL[m] }))}
        value={mode}
        onValueChange={setMode}
      />
      <p className="cr-lab__hint">{MODE_HINT[mode]}</p>

      <RadioGroup
        label="사건"
        options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))}
        value={scenario}
        onValueChange={setScenario}
      />
      <p className="cr-lab__hint">{SCENARIO_HINT[scenario]}</p>

      <div className="cr-lab__controls">
        <label className="cr-field">
          <span>쿠폰 {stock}장</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
        </label>
        <label className="cr-field">
          <span>보류 시간 TTL {ttl}틱</span>
          <input type="range" min={2} max={10} step={1} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} />
          <small>예약이 풀리기까지 걸리는 틱이에요. 결제 응답은 2틱 뒤에 와요.</small>
        </label>
      </div>

      <section className="cr-lab__results" aria-label="결과">
        <Stat label="할인 적용 횟수" value={result.confirmed} unit="건" />
        <Stat label="남은 수량" value={result.remaining} unit="장" tone={result.remaining < 0 ? 'accent' : 'ink'} />
        <Stat
          label="1인 1회 위반"
          value={result.duplicateUsers}
          unit="건"
          tone={result.duplicateUsers > 0 ? 'accent' : 'ink'}
        />
        <Stat label="환불 필요" value={result.refundNeeded} unit="건" />
      </section>

      {hasViolation && (
        <p className="cr-lab__alarm" role="status">
          {alarms.join(' ')}
        </p>
      )}

      <table className="cr-table">
        <caption>요청별 결과 (요청 {result.rows.length}건)</caption>
        <thead>
          <tr>
            <th scope="col">요청</th>
            <th scope="col">사용자</th>
            <th scope="col">틱</th>
            <th scope="col">결제</th>
            <th scope="col">결과</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              <th scope="row">{i + 1}</th>
              <td>{row.user}</td>
              <td>{row.tick}</td>
              <td>{PAY_LABEL[row.pay]}</td>
              <td>
                {row.outcome === 'confirm-failed' ? (
                  <Tag variant="accent">{OUTCOME_LABEL[row.outcome]}</Tag>
                ) : (
                  OUTCOME_LABEL[row.outcome]
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="cr-lab__note">
        수치는 감을 잡기 위한 예시예요. 틱은 DB 요청 한 번을 뜻하는 시뮬레이터의 시간 단위예요.
      </p>
    </div>
  );
}
