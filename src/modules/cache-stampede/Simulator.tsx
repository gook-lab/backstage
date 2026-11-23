import { Alert, Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { perSecond, simulate, STRATEGIES, TICK_MS, type Strategy } from './model';
import './Simulator.css';

const PEAK_ALERT = 10;

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('none');
  const [rate, setRate] = useState(100);
  const [keys, setKeys] = useState(1);
  const [ttlSec, setTtlSec] = useState(10);
  const [dbMs, setDbMs] = useState(500);
  const [seed, setSeed] = useState(7);

  const result = useMemo(
    () => simulate({ strategy, rate, keys, ttlSec, dbMs, seed }),
    [strategy, rate, keys, ttlSec, dbMs, seed],
  );
  const bars = perSecond(result.dbPerTick);
  const barMax = Math.max(1, ...bars);
  const strategyInfo = STRATEGIES.find((s) => s.id === strategy);
  const hitPercent = Math.round(result.hitRatio * 100);
  const maxWaitMs = result.maxWaitTicks * TICK_MS;

  return (
    <div className="cc-lab">
      <RadioGroup
        label="만료된 키를 다루는 방식"
        options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))}
        value={strategy}
        onValueChange={(value) => setStrategy(value as Strategy)}
      />
      <p className="cc-lab__summary">{strategyInfo?.summary}</p>

      <div className="cc-lab__controls">
        <label className="cc-field">
          <span>
            초당 요청 수 <strong>{rate}건</strong>
          </span>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label className="cc-field">
          <span>
            키 개수 <strong>{keys}개</strong>
          </span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={keys}
            onChange={(e) => setKeys(Number(e.target.value))}
          />
        </label>
        <label className="cc-field">
          <span>
            TTL <strong>{ttlSec}초</strong>
          </span>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={ttlSec}
            onChange={(e) => setTtlSec(Number(e.target.value))}
          />
        </label>
        <label className="cc-field">
          <span>
            DB 응답 시간 <strong>{dbMs}ms</strong>
          </span>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={dbMs}
            onChange={(e) => setDbMs(Number(e.target.value))}
          />
        </label>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 순서로 다시 돌리기
        </Button>
      </div>

      {result.peakConcurrentDb > PEAK_ALERT && (
        <Alert tone="warning" title={`만료 순간 같은 키에 DB 조회가 ${result.peakConcurrentDb}개 동시에 나갔어요.`} />
      )}

      <div className="cc-lab__stats">
        <Stat label="만료 순간 동시 DB 조회" value={result.peakConcurrentDb} />
        <Stat label="캐시 적중률" value={`${hitPercent}%`} />
        <Stat label="옛 값 응답" value={result.staleServed} />
        <Stat label="기다린 요청" value={result.blocked} />
        <Stat label="가장 오래 기다림" value={`${maxWaitMs}ms`} />
      </div>

      <figure className="cc-chart">
        <figcaption>초당 DB 조회 수 (최대 {barMax}개)</figcaption>
        <div className="cc-bars" role="img" aria-label={`초당 DB 조회 수 막대 그래프, 최대 ${barMax}개`}>
          {bars.map((count, i) => (
            <span
              key={i}
              className="cc-bar"
              style={{ height: `${(count / barMax) * 100}%` }}
              title={`${i}초: ${count}건`}
            />
          ))}
        </div>
        <div className="cc-chart__axis">
          <span>0초</span>
          <span>30초</span>
          <span>60초</span>
        </div>
      </figure>
    </div>
  );
}
