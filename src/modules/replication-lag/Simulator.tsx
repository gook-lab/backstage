import { Alert, Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { compareStrategies, simulate, STRATEGIES, type Strategy } from './model';
import './Simulator.css';

const MISS_ALERT = 0.05;

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('random');
  const [replicas, setReplicas] = useState(3);
  const [lagMs, setLagMs] = useState(400);
  const [spikePct, setSpikePct] = useState(3);
  const [windowMs, setWindowMs] = useState(5000);
  const [writesPerSec, setWritesPerSec] = useState(10);
  const [seed, setSeed] = useState(7);

  const result = useMemo(
    () => simulate({ strategy, replicas, lagMs, spikePct, windowMs, writesPerSec, seed }),
    [strategy, replicas, lagMs, spikePct, windowMs, writesPerSec, seed],
  );
  const rows = useMemo(
    () => compareStrategies({ replicas, lagMs, spikePct, windowMs, writesPerSec, seed }),
    [replicas, lagMs, spikePct, windowMs, writesPerSec, seed],
  );
  const strategyInfo = STRATEGIES.find((s) => s.id === strategy);

  return (
    <div className="rl-lab">
      <RadioGroup
        label="읽기를 보내는 방식"
        options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))}
        value={strategy}
        onValueChange={(value) => setStrategy(value as Strategy)}
      />
      <p className="rl-lab__summary">{strategyInfo?.summary}</p>

      <div className="rl-lab__controls">
        <label className="rl-field">
          <span>
            읽기 복제본 수 <strong>{replicas}개</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={replicas}
            onChange={(e) => setReplicas(Number(e.target.value))}
          />
        </label>
        <label className="rl-field">
          <span>
            복제 평균 지연 <strong>{lagMs}ms</strong>
          </span>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={lagMs}
            onChange={(e) => setLagMs(Number(e.target.value))}
          />
        </label>
        <label className="rl-field">
          <span>
            지연이 튀는 확률 <strong>{spikePct}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={spikePct}
            onChange={(e) => setSpikePct(Number(e.target.value))}
          />
        </label>
        <label className="rl-field">
          <span>
            쓴 뒤 주 DB 로 읽는 시간 <strong>{windowMs / 1000}초</strong>
          </span>
          <input
            type="range"
            min={0}
            max={10000}
            step={500}
            value={windowMs}
            onChange={(e) => setWindowMs(Number(e.target.value))}
          />
        </label>
        <label className="rl-field">
          <span>
            초당 쓰기 수 <strong>{writesPerSec}건</strong>
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={writesPerSec}
            onChange={(e) => setWritesPerSec(Number(e.target.value))}
          />
        </label>
      </div>

      <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
        다른 순서로 다시 돌리기
      </Button>

      {result.firstMissRatio > MISS_ALERT && (
        <Alert tone="warning" title={`방금 쓴 글이 저장 뒤 첫 목록에서 ${percent(result.firstMissRatio)} 빠졌어요.`} />
      )}

      <div className="rl-lab__stats">
        <Stat label="첫 목록에서 안 보임" value={percent(result.firstMissRatio)} />
        <Stat label="새로고침 때 뒤로 간 횟수" value={`${result.regressions}회`} />
        <Stat label="주 DB 읽기 비율" value={percent(result.primaryShare)} />
        <Stat label="주 DB 읽기 (초당)" value={result.primaryPerSec.toFixed(1)} />
        <Stat label="복제 지연 95분위" value={`${result.lagP95Ms}ms`} />
      </div>

      <figure className="rl-table-wrap">
        <figcaption>같은 조건에서 다섯 방식 비교 (현재 고른 방식은 굵게 보여요)</figcaption>
        <table className="rl-table">
          <thead>
            <tr>
              <th scope="col">방식</th>
              <th scope="col">첫 목록에서 안 보임</th>
              <th scope="col">뒤로 간 횟수</th>
              <th scope="col">주 DB 읽기 비율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, result: row }) => {
              const label = STRATEGIES.find((s) => s.id === id)?.label ?? id;
              const active = id === strategy;
              return (
                <tr key={id} className={active ? 'rl-table__active' : undefined} aria-current={active || undefined}>
                  <th scope="row">{label}</th>
                  <td>{percent(row.firstMissRatio)}</td>
                  <td>{row.regressions}회</td>
                  <td>{percent(row.primaryShare)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
