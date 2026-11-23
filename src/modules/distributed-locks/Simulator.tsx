import { Alert, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  type CellState,
  MAX_TICK,
  SCENARIOS,
  type ScenarioId,
  scenarioById,
  simulate,
  STRATEGIES,
  type Strategy,
} from './model';
import './Simulator.css';

const CELL_LABEL: Record<CellState, string> = {
  idle: '',
  run: '실행',
  pause: '정지',
  applied: '반영',
  rejected: '거절',
  skipped: '건너뜀',
  done: '끝',
};

const TICKS = Array.from({ length: MAX_TICK + 1 }, (_, i) => i);

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('none');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('simultaneous');

  const scenario = scenarioById(scenarioId);
  const strategyInfo = STRATEGIES.find((s) => s.id === strategy);
  const result = useMemo(() => simulate(strategy, scenario), [strategy, scenario]);
  const workers = scenario.workers;

  const duplicated = result.applied > 1;

  return (
    <div className="dl-lab">
      <RadioGroup
        label="방식"
        options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))}
        value={strategy}
        onValueChange={(v) => setStrategy(v as Strategy)}
      />
      <p className="dl-lab__hint">{strategyInfo?.hint}</p>

      <RadioGroup
        label="사건"
        options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
        value={scenarioId}
        onValueChange={(v) => setScenarioId(v as ScenarioId)}
      />
      <p className="dl-lab__hint">{scenario.hint}</p>

      <div className="dl-lab__stats">
        <Stat label="실행 횟수" value={result.executions} />
        <Stat label="반영된 쓰기" value={result.applied} />
        <Stat label="거절된 쓰기" value={result.rejected} />
      </div>

      {duplicated ? (
        <Alert tone="warning" title={`정산이 ${result.applied}번 저장됐어요. 같은 작업이 두 번 반영된 거예요.`} />
      ) : (
        <Alert tone="success" title="정산은 한 번만 저장됐어요." />
      )}

      {strategy === 'dbUnique' && result.executions > result.applied && (
        <p className="dl-lab__hint">
          유일 제약은 저장소만 지켜요. 본문이 외부 API를 호출했다면 실행 횟수만큼 호출이 나갔을 수 있어요.
        </p>
      )}

      <div className="dl-lab__timeline" role="region" aria-label="틱별 타임라인">
        <table className="dl-grid">
          <thead>
            <tr>
              <th scope="col">작업</th>
              {TICKS.map((t) => (
                <th key={t} scope="col">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id}>
                <th scope="row">
                  {w.id} <span className="dl-grid__server">서버 {w.server}</span>
                </th>
                {result.frames.map((f) => {
                  const state = f.cells[w.id] ?? 'idle';
                  return (
                    <td key={f.tick} data-state={state}>
                      {CELL_LABEL[state]}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="dl-grid__lock">
              <th scope="row">락 보유자</th>
              {result.frames.map((f) => (
                <td key={f.tick} className="dl-grid__lockcell">
                  {f.holder ? f.holder : f.expired ? '만료' : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dl-lab__hint">
        틱은 시간 단위 한 칸이에요. 칸에 마우스를 올리면 그 틱의 락 상태가 보여요. 실제 밀리초와는 관계가 없어요.
      </p>

      <section className="dl-lab__log" aria-label="이벤트 기록">
        <h3>이벤트 기록</h3>
        <ol>
          {result.events.map((e, i) => (
            <li key={`${e.tick}-${e.workerId}-${i}`} data-kind={e.kind}>
              <span className="dl-lab__tick">{e.tick}틱</span> <strong>{e.workerId}</strong> {e.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
