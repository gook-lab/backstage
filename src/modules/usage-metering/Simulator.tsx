import { Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ATTRIBUTIONS,
  ATTRIBUTION_LABEL,
  type Attribution,
  DEFAULT_LIMIT,
  HORIZON,
  LIMIT_MAX,
  LIMIT_MIN,
  METHOD_LABEL,
  METHODS,
  type Method,
  SCENARIO_LABEL,
  SCENARIOS,
  type Scenario,
  clockLabel,
  simulate,
} from './model';
import './Simulator.css';

const METHOD_HINT: Record<Method, string> = {
  counter: '요청이 들어올 때 DB 카운터를 올려요. 화면과 한도가 같은 숫자를 봐요. 대신 인기 행 하나에 쓰기가 몰려요.',
  events:
    '요청은 이벤트로 쌓고 1분마다 집계해요. 화면과 한도 판단이 집계 값을 봐서, 집계 사이의 호출은 아직 안 보여요.',
  'events-fast':
    '요청 경로의 빠른 카운터로 막고, 청구는 이벤트로 따로 맞춰요. 막는 숫자는 정확하고, 화면 숫자는 여전히 늦어요.',
};

export default function Simulator() {
  const [method, setMethod] = useState<Method>('events');
  const [scenario, setScenario] = useState<Scenario>('burst');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [dedupe, setDedupe] = useState(true);
  const [attribution, setAttribution] = useState<Attribution>('occurred');
  const [tick, setTick] = useState(33);

  const r = simulate({ method, scenario, limit, dedupe, attribution, tick });
  const countsOnEvents = method !== 'counter';
  const cur = tick < 60 ? '이번 달' : '다음 달';

  return (
    <div className="um-lab">
      <RadioGroup
        label="기록 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="um-lab__hint">{METHOD_HINT[method]}</p>

      <RadioGroup
        label="사건"
        options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))}
        value={scenario}
        onValueChange={setScenario}
      />

      <div className="um-lab__controls">
        <label className="um-field">
          <span>이번 달 한도 {limit}건</span>
          <input
            type="range"
            min={LIMIT_MIN}
            max={LIMIT_MAX}
            step={5}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <label className="um-field">
          <span>
            화면을 보는 시각 {clockLabel(tick)} (틱 {tick}/{HORIZON}, 10초 단위)
          </span>
          <input
            type="range"
            min={0}
            max={HORIZON}
            step={1}
            value={tick}
            onChange={(e) => setTick(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="um-lab__toggles">
        <Checkbox
          label="멱등성 키로 같은 호출의 이벤트를 한 번만 세요"
          hint="끄면 재전송된 이벤트가 두 번 세어져요."
          checked={dedupe}
          disabled={!countsOnEvents}
          onCheckedChange={(checked) => setDedupe(checked === true)}
        />
      </div>

      <RadioGroup
        label="청구 기준 시각"
        options={ATTRIBUTIONS.map((a) => ({ value: a, label: ATTRIBUTION_LABEL[a] }))}
        value={attribution}
        onValueChange={setAttribution}
      />
      {!countsOnEvents && (
        <p className="um-lab__hint">요청마다 카운터는 발생 시각으로만 세요. 이 설정은 이벤트 방식에만 적용돼요.</p>
      )}

      <section className="um-lab__results" aria-label="결과">
        <Stat label="화면 숫자" value={r.screen} unit="건" />
        <Stat label="실제 호출" value={r.actual} unit="건" />
        <Stat label="한도 초과 허용" value={r.overLimit} unit="건" tone={r.overLimit > 0 ? 'accent' : 'ink'} />
        <Stat label="잘못 막은 호출" value={r.falseBlocks} unit="건" tone={r.falseBlocks > 0 ? 'accent' : 'ink'} />
      </section>

      {r.overLimit > 0 && (
        <p className="um-lab__alarm" role="status">
          한도 {limit}건에 닿은 뒤에도 {r.overLimit}건이 통과했어요. 막는 쪽이 집계 값을 보고 있었기 때문이에요.
        </p>
      )}
      {r.falseBlocks > 0 && (
        <p className="um-lab__alarm" role="status">
          한도 안인데 {r.falseBlocks}건이 막혔어요. 같은 호출의 이벤트가 집계를 먼저 채웠기 때문이에요.
        </p>
      )}

      <p className="um-lab__note">
        {countsOnEvents
          ? `기준 시각 ${clockLabel(r.snapTick)} · 화면은 이 시각까지 도착한 이벤트만 세요. ${cur} 기준이에요.`
          : `요청 즉시 반영돼요. ${cur} 기준이에요.`}
      </p>

      <section className="um-lab__billing" aria-labelledby="um-billing-title">
        <h3 id="um-billing-title">청구 결과 (타임라인 끝 기준)</h3>
        <table className="um-table">
          <caption>청구 대상 달과 정정 항목</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">건수</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">이번 달 청구</th>
              <td>{r.billed[0]}</td>
            </tr>
            <tr>
              <th scope="row">다음 달 청구</th>
              <td>{r.billed[1]}</td>
            </tr>
            <tr>
              <th scope="row">정정 항목 (마감 뒤 도착)</th>
              <td>{r.corrections}</td>
            </tr>
            <tr>
              <th scope="row">발생 달과 다른 달에 든 건수</th>
              <td>{r.misplaced}</td>
            </tr>
            <tr>
              <th scope="row">허용된 호출 (중복 제외)</th>
              <td>{r.accepted}</td>
            </tr>
          </tbody>
        </table>
        {scenario === 'boundary' && r.focusBilled !== null && (
          <p className="um-lab__note">
            {clockLabel(54)}에 보낸 호출은 {r.focusBilled === 1 ? '이번 달' : '다음 달'} 청구에 들어가요.
            {attribution === 'arrived' ? ` ${clockLabel(66)}에 도착한 기준이에요.` : ' 발생 시각 기준이에요.'}
          </p>
        )}
      </section>

      <p className="um-lab__note">
        수치는 감을 잡기 위한 예시예요. 한도 100건과 1분 집계 간격은 이 시뮬레이터 안의 가정이에요.
      </p>
    </div>
  );
}
