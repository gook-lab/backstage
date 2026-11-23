import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  HORIZON,
  METHOD_HINT,
  METHOD_LABEL,
  METHODS,
  type Method,
  STRATEGIES,
  STRATEGY_HINT,
  STRATEGY_LABEL,
  type Strategy,
  formatCount,
  simulate,
} from './model';
import './Simulator.css';

const SVG_W = 300;
const SVG_H = 96;

function Trend({ truth, shown, tick }: { truth: readonly number[]; shown: readonly number[]; tick: number }) {
  const max = Math.max(1, ...truth, ...shown);
  const x = (i: number) => (i / HORIZON) * SVG_W;
  const y = (v: number) => SVG_H - (v / max) * (SVG_H - 4) - 2;
  const line = (values: readonly number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg
      className="hc-trend"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline className="hc-trend__truth" points={line(truth)} />
      <polyline className="hc-trend__shown" points={line(shown)} />
      <line className="hc-trend__now" x1={x(tick)} x2={x(tick)} y1={0} y2={SVG_H} />
    </svg>
  );
}

export default function Simulator() {
  const legendId = useId();
  const [strategy, setStrategy] = useState<Strategy>('single');
  const [method, setMethod] = useState<Method>('post');
  const [shards, setShards] = useState(4);
  const [flushEvery, setFlushEvery] = useState(5);
  const [likesPerTick, setLikesPerTick] = useState(60);
  const [unlikePct, setUnlikePct] = useState(10);
  const [dupPct, setDupPct] = useState(20);
  const [crashOn, setCrashOn] = useState(false);
  const [crashTick, setCrashTick] = useState(25);
  const [seed, setSeed] = useState(7);
  const [tick, setTick] = useState(HORIZON);

  const result = simulate({
    strategy,
    method,
    shards,
    flushEvery,
    likesPerTick,
    unlikeRate: unlikePct / 100,
    doubleTapRate: dupPct / 100,
    crashTick: strategy === 'buffered' && crashOn ? crashTick : null,
    seed,
  });

  const shownNow = result.displayedByTick[tick];
  const truthNow = result.truthByTick[tick];
  const splitStrategy = strategy === 'sharded';
  const batched = strategy === 'buffered' || strategy === 'log';

  return (
    <div className="hc-lab">
      <RadioGroup
        label="카운터 쓰기 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="hc-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <RadioGroup
        label="좋아요 요청 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="hc-lab__hint">{METHOD_HINT[method]}</p>

      <div className="hc-lab__controls">
        <label className="hc-field">
          <span>좋아요 요청 {likesPerTick}건 / 틱</span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={likesPerTick}
            onChange={(e) => setLikesPerTick(Number(e.target.value))}
          />
        </label>
        <label className="hc-field">
          <span>좋아요 취소 {unlikePct}%</span>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={unlikePct}
            onChange={(e) => setUnlikePct(Number(e.target.value))}
          />
        </label>
        <label className="hc-field">
          <span>더블 탭 {dupPct}%</span>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={dupPct}
            onChange={(e) => setDupPct(Number(e.target.value))}
          />
        </label>
        <label className="hc-field">
          <span>카운터 조각 {shards}개</span>
          <input
            type="range"
            min={2}
            max={16}
            step={1}
            value={shards}
            disabled={!splitStrategy}
            onChange={(e) => setShards(Number(e.target.value))}
          />
          {!splitStrategy && <small>조각 나누기를 고를 때만 쓰여요.</small>}
        </label>
        <label className="hc-field">
          <span>반영 주기 {flushEvery}틱</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={flushEvery}
            disabled={!batched}
            onChange={(e) => setFlushEvery(Number(e.target.value))}
          />
          {!batched && <small>모아서 반영할 때만 쓰여요.</small>}
        </label>
        <label className="hc-field">
          <span className="hc-check">
            <input
              type="checkbox"
              checked={crashOn}
              disabled={strategy !== 'buffered'}
              onChange={(e) => setCrashOn(e.target.checked)}
            />
            {crashOn && strategy === 'buffered' ? `틱 ${crashTick} 에 장애` : '장애 넣기'}
          </span>
          <input
            type="range"
            min={0}
            max={39}
            step={1}
            value={crashTick}
            disabled={!crashOn || strategy !== 'buffered'}
            onChange={(e) => setCrashTick(Number(e.target.value))}
          />
          {strategy !== 'buffered' && <small>Redis 에 모아 두는 방식에서만 값을 잃어요.</small>}
        </label>
      </div>

      <div className="hc-lab__seed">
        <span>시드 {seed} · 같은 시드는 항상 같은 사용자 흐름이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="hc-lab__results" aria-label="결과">
        <Stat label="가장 긴 대기 줄" value={result.peakQueue} unit="건" />
        <Stat label="평균 대기" value={result.avgWait.toFixed(1)} unit="틱" />
        <Stat label="화면에 보이는 수" value={formatCount(result.finalDisplayed)} />
        <Stat label="실제 좋아요 수" value={formatCount(result.finalTruth)} />
      </section>

      {(result.drift !== 0 || result.lost > 0) && (
        <p className="hc-lab__alarm" role="status">
          {result.drift !== 0 && `숫자가 실제와 ${Math.abs(result.drift)}만큼 어긋나요. 중복 요청이 숫자를 바꿨어요. `}
          {result.lost > 0 && `장애로 반영 전 ${result.lost}건을 잃었어요.`}
        </p>
      )}

      <section className="hc-lab__trend" aria-labelledby={`${legendId}-trend`}>
        <h3 id={`${legendId}-trend`}>실제 수와 화면 수 (시각별)</h3>
        <Trend truth={result.truthByTick} shown={result.displayedByTick} tick={tick} />
        <p className="hc-lab__note">
          진한 선이 실제 수, 밝은 선이 화면 수예요. 세로 선은 틱 {tick} 이에요. 실제보다 낮으면 아직 반영되지 않은
          값이에요.
        </p>
      </section>

      <section className="hc-lab__timeline" aria-label="시각별 상태">
        <label className="hc-field">
          <span>
            틱 {tick} / {HORIZON} (시뮬레이터의 시간 단위예요)
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
        <dl className="hc-lab__now">
          <div>
            <dt>실제 수</dt>
            <dd>{truthNow}</dd>
          </div>
          <div>
            <dt>화면 수</dt>
            <dd>{shownNow}</dd>
          </div>
          <div>
            <dt>차이</dt>
            <dd>{truthNow - shownNow}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
