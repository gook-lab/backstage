import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type ConnState,
  EDGE_RTT,
  MAX_REQUESTS,
  PROTOCOLS,
  type Protocol,
  RTT_PRESETS,
  SERVER_MS,
  STATES,
  buildTimeline,
  clampDepth,
  compareRows,
} from './model';
import './Simulator.css';

const ms = (value: number) => `${value.toLocaleString('ko-KR')}ms`;

export default function Simulator() {
  const [rtt, setRtt] = useState(250);
  const [protocol, setProtocol] = useState<Protocol>('h2-tls13');
  const [state, setState] = useState<ConnState>('new');
  const [edge, setEdge] = useState(false);
  const [edgeHit, setEdgeHit] = useState(true);
  const [count, setCount] = useState(3);
  const [depth, setDepth] = useState(2);
  const [parallel, setParallel] = useState(true);

  const config = { rtt, protocol, state, edge, edgeHit, count, depth: clampDepth(count, depth), parallel };
  const timeline = buildTimeline(config);
  const rows = compareRows(config);
  const maxStep = Math.max(...timeline.steps.map((s) => s.ms), 1);

  return (
    <div className="nl-lab">
      <RadioGroup
        label="사용자와 오리진 사이 RTT (예시)"
        options={RTT_PRESETS.map((v) => ({ value: String(v), label: `${v}ms` }))}
        value={String(rtt)}
        onValueChange={(value) => setRtt(Number(value))}
      />

      <div className="nl-lab__row">
        <RadioGroup
          label="프로토콜"
          options={PROTOCOLS.map((p) => ({ value: p.value, label: p.label }))}
          value={protocol}
          onValueChange={(value) => setProtocol(value as Protocol)}
        />
        <RadioGroup
          label="연결 상태"
          options={STATES.map((s) => ({ value: s.value, label: s.label }))}
          value={state}
          onValueChange={(value) => setState(value as ConnState)}
        />
      </div>
      <p className="nl-lab__hint">
        {PROTOCOLS.find((p) => p.value === protocol)?.hint} {STATES.find((s) => s.value === state)?.hint}
      </p>

      <div className="nl-lab__row">
        <fieldset className="nl-lab__fieldset">
          <legend>CDN 엣지</legend>
          <Checkbox label="엣지 사용" checked={edge} onCheckedChange={(checked) => setEdge(checked === true)} />
          <Checkbox
            label="엣지에 응답이 있어요 (적중)"
            hint={`끄면 엣지가 오리진까지 한 번 더 다녀와요. 엣지 RTT 는 ${EDGE_RTT}ms 로 가정해요.`}
            checked={edgeHit}
            disabled={!edge}
            onCheckedChange={(checked) => setEdgeHit(checked === true)}
          />
        </fieldset>

        <fieldset className="nl-lab__fieldset">
          <legend>첫 화면 요청</legend>
          <label className="nl-lab__range">
            <span>
              요청 수 <strong>{count}건</strong>
            </span>
            <input
              type="range"
              min={1}
              max={MAX_REQUESTS}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label className="nl-lab__range">
            <span>
              앞 응답을 기다리는 단계 수 <strong>{config.depth}단계</strong>
            </span>
            <input
              type="range"
              min={1}
              max={count}
              value={config.depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
          <Checkbox
            label="같은 단계 요청을 한꺼번에 보내기"
            hint="끄면 요청을 하나씩 보내서 요청 수만큼 왕복이 더해져요."
            checked={parallel}
            onCheckedChange={(checked) => setParallel(checked === true)}
          />
        </fieldset>
      </div>

      <section className="nl-lab__result" aria-label="첫 화면까지 시간">
        <p className="nl-lab__verdict">
          첫 화면 데이터까지 <strong>{ms(timeline.total)}</strong>
        </p>
        <p className="nl-lab__hint">
          왕복 {timeline.roundTrips}회 · 요청 한 번의 서버 처리 {SERVER_MS}ms 를 더했어요. 모든 값은 예시예요. 실측
          RTT가 아니에요.
        </p>
        <ol className="nl-lab__steps">
          {timeline.steps.map((step) => (
            <li key={step.label}>
              <span className="nl-lab__step-label">{step.label}</span>
              <span className="nl-lab__bar-track">
                <span className="nl-lab__bar" style={{ width: `${(step.ms / maxStep) * 100}%` }} />
              </span>
              <span className="nl-lab__step-ms">
                {ms(step.ms)} · 누적 {ms(step.cumulative)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="nl-lab__result" aria-label="프로토콜 비교">
        <p className="nl-lab__hint">지금 요청 설정을 그대로 두고 프로토콜과 연결 상태만 바꿔 비교해요.</p>
        <div className="nl-lab__table-wrap">
          <table className="nl-lab__table">
            <caption>
              RTT {rtt}ms · 요청 {count}건 · 단계 {config.depth}
            </caption>
            <thead>
              <tr>
                <th scope="col">프로토콜 · 연결</th>
                <th scope="col">왕복 수</th>
                <th scope="col">첫 응답</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = row.protocol === protocol && row.state === state;
                const protocolLabel = PROTOCOLS.find((p) => p.value === row.protocol)?.label;
                const stateLabel = STATES.find((s) => s.value === row.state)?.label;
                return (
                  <tr key={`${row.protocol}-${row.state}`} data-selected={selected ? 'true' : undefined}>
                    <th scope="row">
                      {protocolLabel} · {stateLabel}
                    </th>
                    <td>{row.roundTrips}회</td>
                    <td>{ms(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
