import { Alert, RadioGroup, Stat, Tag, cx } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Algorithm,
  type Pattern,
  buildPattern,
  maxAllowedInWindow,
  promisedMax,
  runLimiter,
  runSpike,
} from './model';
import './Simulator.css';

const ALGORITHM_OPTIONS: { value: Algorithm; label: string }[] = [
  { value: 'fixed', label: '고정 창' },
  { value: 'sliding', label: '슬라이딩 로그' },
  { value: 'token', label: '토큰 버킷' },
];

const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
  { value: 'steady', label: '일정한 속도' },
  { value: 'edge', label: '창 경계에 몰림' },
  { value: 'burst', label: '한순간에 몰림' },
];

const ALGORITHM_NAME: Record<Algorithm, string> = {
  fixed: '고정 창',
  sliding: '슬라이딩 로그',
  token: '토큰 버킷',
};

export default function Simulator() {
  return (
    <div className="wr">
      <SpikePart />
      <LimiterPart />
    </div>
  );
}

function SpikePart() {
  const [users, setUsers] = useState(1000);
  const [capacity, setCapacity] = useState(100);
  const [admit, setAdmit] = useState(100);
  const [mode, setMode] = useState<'open' | 'room'>('open');

  const result = runSpike({ users, capacity, admitPerTick: mode === 'room' ? admit : null });
  const peakTicks = result.ticks.slice(0, 12);
  const scale = Math.max(1, ...peakTicks.map((t) => t.load));
  const overloaded = result.peakLoad > capacity;

  return (
    <section className="wr-part" aria-labelledby="wr-spike-title">
      <h3 id="wr-spike-title" className="wr-part__title">
        1 · 티켓 오픈 순간
      </h3>
      <p className="wr-hint">
        1틱은 1초예요. 모든 사용자는 0틱에 한꺼번에 도착하고, 실패하면 다음 틱에 다시 시도해요. 최대 3번까지 시도해요.
      </p>

      <RadioGroup
        label="입장 방식"
        options={[
          { value: 'open', label: '보호 없음' },
          { value: 'room', label: '대기실 · 초당 입장 제한' },
        ]}
        value={mode}
        onValueChange={setMode}
      />

      <div className="wr-sliders">
        <label className="wr-slider">
          <span>동시 접속 {users.toLocaleString('ko-KR')}명</span>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={users}
            onChange={(e) => setUsers(Number(e.target.value))}
          />
        </label>
        <label className="wr-slider">
          <span>백엔드 처리 능력 C · 초당 {capacity}건</span>
          <input
            type="range"
            min={50}
            max={500}
            step={50}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </label>
        {mode === 'room' && (
          <label className="wr-slider">
            <span>대기실 입장 속도 R · 초당 {admit}명</span>
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={admit}
              onChange={(e) => setAdmit(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      <div className="wr-stats">
        <Stat label="성공" value={`${result.succeeded.toLocaleString('ko-KR')}명`} />
        <Stat label="포기" value={`${result.gaveUp.toLocaleString('ko-KR')}명`} />
        <Stat label="최고 부하" value={result.peakLoad.toLocaleString('ko-KR')} unit="건/초" />
        <Stat label="평균 대기" value={result.avgWait === null ? '-' : result.avgWait.toFixed(1)} unit="틱" />
      </div>

      <Alert
        tone={overloaded ? 'warning' : 'success'}
        title={
          overloaded
            ? `백엔드 처리 능력 ${capacity}건을 넘는 요청이 ${result.peakLoad}건까지 몰렸어요.`
            : `최고 부하가 처리 능력 ${capacity}건 안에 머물렀어요.`
        }
      />

      <div className="wr-bars" aria-label="틱별 부하">
        {peakTicks.map((t) => (
          <div key={t.tick} className="wr-bar-row">
            <span className="wr-bar-row__label">{t.tick}틱</span>
            <span className="wr-bar-track">
              <span className="wr-bar" style={{ width: `${(t.load / scale) * 100}%` }} />
            </span>
            <span className="wr-bar-row__value">
              부하 {t.load} · 성공 {t.served} · 실패 {t.failed}
            </span>
          </div>
        ))}
        {result.ticks.length > peakTicks.length && (
          <p className="wr-hint">처음 12틱만 그렸어요. 전체 {result.ticks.length}틱이에요.</p>
        )}
      </div>
    </section>
  );
}

function LimiterPart() {
  const [algorithm, setAlgorithm] = useState<Algorithm>('fixed');
  const [pattern, setPattern] = useState<Pattern>('edge');
  const [limit, setLimit] = useState(5);
  const [windowMs, setWindowMs] = useState(1000);
  const [refillPerSec, setRefillPerSec] = useState(5);

  const cfg = { algorithm, limit, windowMs, refillPerSec };
  const times = buildPattern(pattern, cfg);
  const decisions = runLimiter(times, cfg);
  const allowed = decisions.filter((d) => d.allowed).length;
  const denied = decisions.length - allowed;
  const peak = maxAllowedInWindow(decisions, windowMs);
  const promised = promisedMax(cfg);
  const leaked = peak > promised;
  const summary = `${ALGORITHM_NAME[algorithm]}: 요청 ${decisions.length}개 중 ${allowed}개 통과, ${denied}개 429. ${windowMs}ms 창 안 최대 ${peak}개.`;

  return (
    <section className="wr-part" aria-labelledby="wr-limiter-title">
      <h3 id="wr-limiter-title" className="wr-part__title">
        2 · 요청 제한 놀이터
      </h3>
      <p className="wr-hint">알고리즘과 패턴을 바꿔 보세요. 통과와 429 가 요청마다 표시돼요.</p>

      <RadioGroup label="알고리즘" options={ALGORITHM_OPTIONS} value={algorithm} onValueChange={setAlgorithm} />
      <RadioGroup label="요청 패턴" options={PATTERN_OPTIONS} value={pattern} onValueChange={setPattern} />

      <div className="wr-sliders">
        <label className="wr-slider">
          <span>{algorithm === 'token' ? `버킷 용량 ${limit}개` : `한도 ${limit}건`}</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        {algorithm !== 'token' && (
          <label className="wr-slider">
            <span>창 길이 {windowMs}ms</span>
            <input
              type="range"
              min={500}
              max={2000}
              step={500}
              value={windowMs}
              onChange={(e) => setWindowMs(Number(e.target.value))}
            />
          </label>
        )}
        {algorithm === 'token' && (
          <label className="wr-slider">
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
      </div>

      <p className="wr-summary" aria-live="polite">
        {summary}
      </p>

      <Alert
        tone={leaked ? 'warning' : 'info'}
        title={
          leaked
            ? `${windowMs}ms 창 안에서 약속한 ${promised}개를 넘는 ${peak}개가 통과했어요.`
            : `${windowMs}ms 창 안 통과는 약속한 ${promised}개 이하예요.`
        }
      />

      <ol className="wr-timeline" aria-label="요청별 결과">
        {decisions.map((d, i) => (
          <li key={`${i}-${d.atMs}`} className={cx('wr-req', !d.allowed && 'wr-req--deny')}>
            <span className="wr-req__time">{d.atMs}ms</span>
            <Tag variant={d.allowed ? 'outline' : 'accent'}>{d.allowed ? '통과' : '429'}</Tag>
          </li>
        ))}
      </ol>
    </section>
  );
}
