import { Alert, RadioGroup, Stat, cx } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Algorithm,
  type Pattern,
  RUN_MS,
  type Topology,
  WINDOW_MS,
  buildPattern,
  maxServedInWindow,
  promisedMax,
  runTopology,
} from './model';
import './Simulator.css';

const ALGORITHM_OPTIONS: { value: Algorithm; label: string }[] = [
  { value: 'fixed', label: '고정 창' },
  { value: 'log', label: '슬라이딩 로그' },
  { value: 'counter', label: '슬라이딩 카운터' },
  { value: 'token', label: '토큰 버킷' },
  { value: 'leaky', label: '누수 버킷' },
];

const ALGORITHM_NAME: Record<Algorithm, string> = {
  fixed: '고정 창',
  log: '슬라이딩 로그',
  counter: '슬라이딩 카운터',
  token: '토큰 버킷',
  leaky: '누수 버킷',
};

const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
  { value: 'steady', label: '고른 흐름 (약속의 1.5배)' },
  { value: 'edge', label: '창 경계에 몰림' },
  { value: 'burst', label: '한순간 폭주' },
  { value: 'random', label: '무작위 도착' },
];

const TOPOLOGY_OPTIONS: { value: Topology; label: string }[] = [
  { value: 'single', label: '서버 1대' },
  { value: 'two-local', label: '서버 2대 · 카운터 각자' },
  { value: 'two-shared', label: '서버 2대 · 공유 카운터' },
];

const pct = (ms: number) => `${(ms / RUN_MS) * 100}%`;

export default function Simulator() {
  const [algorithm, setAlgorithm] = useState<Algorithm>('fixed');
  const [pattern, setPattern] = useState<Pattern>('edge');
  const [topology, setTopology] = useState<Topology>('single');
  const [limit, setLimit] = useState(5);
  const [refillPerSec, setRefillPerSec] = useState(5);
  const [seed, setSeed] = useState(1);

  const cfg = { algorithm, limit, windowMs: WINDOW_MS, refillPerSec };
  const times = buildPattern(pattern, { limit, windowMs: WINDOW_MS, seed });
  const decisions = runTopology(times, cfg, topology);
  const allowed = decisions.filter((d) => d.allowed).length;
  const denied = decisions.length - allowed;
  const peak = maxServedInWindow(decisions, WINDOW_MS);
  const promised = promisedMax(cfg);
  const leaked = peak > promised;
  const summary = `${ALGORITHM_NAME[algorithm]}: 요청 ${decisions.length}개 중 ${allowed}개 통과, ${denied}개 429. 1초 구간 최대 처리 ${peak}개(약속 ${promised}개).`;

  return (
    <section className="ra" aria-labelledby="ra-title">
      <h3 id="ra-title" className="ra-title">
        요청 제한 놀이터
      </h3>
      <p className="ra-hint">
        타임라인은 3초예요. 도착 줄은 서버가 받은 순간이고, 처리 줄은 실제로 처리가 시작된 순간이에요. 누수 버킷은 두
        줄이 달라요.
      </p>

      <RadioGroup label="요청 패턴" options={PATTERN_OPTIONS} value={pattern} onValueChange={setPattern} />
      <RadioGroup label="알고리즘" options={ALGORITHM_OPTIONS} value={algorithm} onValueChange={setAlgorithm} />
      <RadioGroup label="서버 구성" options={TOPOLOGY_OPTIONS} value={topology} onValueChange={setTopology} />

      <div className="ra-sliders">
        <label className="ra-slider">
          <span>{algorithm === 'token' ? `버킷 용량 ${limit}개` : `한도 ${limit}건 / 1초`}</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        {algorithm === 'token' && (
          <label className="ra-slider">
            <span>초당 보충 {refillPerSec}개</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={refillPerSec}
              onChange={(e) => setRefillPerSec(Number(e.target.value))}
            />
          </label>
        )}
        {pattern === 'random' && (
          <label className="ra-slider">
            <span>무작위 시드 {seed}</span>
            <input
              type="range"
              min={1}
              max={9}
              step={1}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      <div className="ra-stats">
        <Stat label="통과" value={`${allowed}건`} />
        <Stat label="429" value={`${denied}건`} />
        <Stat label="1초 최대 처리" value={`${peak}`} unit="건" />
        <Stat label="약속한 한도" value={`${promised}`} unit="건" />
      </div>

      <p className="ra-summary" aria-live="polite">
        {summary}
      </p>

      <Alert
        tone={leaked ? 'warning' : 'info'}
        title={
          leaked
            ? `1초 구간에 약속한 ${promised}개를 넘는 ${peak}개가 처리됐어요.`
            : `1초 구간 최대 처리량이 약속한 ${promised}개 안에 있어요.`
        }
      />

      <div className="ra-lanes" aria-label="도착과 처리 시각">
        <Lane label="도착" items={decisions.map((d) => ({ at: d.atMs, allowed: d.allowed }))} showDenied />
        <Lane
          label="처리"
          items={decisions.filter((d) => d.allowed).map((d) => ({ at: d.servedAtMs, allowed: true }))}
        />
        <div className="ra-axis" aria-hidden="true">
          <span className="ra-axis__label" />
          <span className="ra-axis__ticks">
            <span>0초</span>
            <span>1초</span>
            <span>2초</span>
            <span>3초</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function Lane({
  label,
  items,
  showDenied = false,
}: {
  label: string;
  items: { at: number; allowed: boolean }[];
  showDenied?: boolean;
}) {
  return (
    <div className="ra-lane">
      <span className="ra-lane__label">{label}</span>
      <span className="ra-lane__track">
        {items.map((it, i) => (
          <span
            key={`${i}-${it.at}`}
            className={cx('ra-dot', !it.allowed && showDenied && 'ra-dot--deny')}
            style={{ left: pct(it.at) }}
            title={`${it.at}ms ${it.allowed ? '통과' : '429'}`}
          />
        ))}
      </span>
    </div>
  );
}
