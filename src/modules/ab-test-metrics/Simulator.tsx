import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { BASE_RATE, CRITICAL_Z, DAYS, type Judge, type RecordMode, type Params, summarize } from './model';
import './Simulator.css';

const JUDGE_OPTIONS: { value: Judge; label: string }[] = [
  { value: 'fixed', label: '기간 끝에 한 번' },
  { value: 'daily', label: '매일 보고 유의하면 멈춤' },
];

const JUDGE_HINT: Record<Judge, string> = {
  fixed: `기간을 ${DAYS}일로 미리 정하고 끝에 한 번만 봐요.`,
  daily: '매일 결과를 보고 유의하면 멈춰요. 한 번만 보는 것보다 잘못 찾아내는 비율이 늘어요.',
};

const RECORD_OPTIONS: { value: RecordMode; label: string }[] = [
  { value: 'assign', label: '배정 시 기록' },
  { value: 'expose', label: '실제 노출 시 기록' },
];

const RECORD_HINT: Record<RecordMode, string> = {
  assign: '배정된 방문자를 모두 세요. 버튼을 못 본 사람도 들어가서 효과가 희석돼요.',
  expose: '버튼이 실제로 보인 방문자만 세요. 설정한 효과가 그대로 측정돼요.',
};

const SVG_W = 300;
const SVG_H = 120;
const Z_MAX = 4;

function ZChart({ values, judge }: { values: readonly number[]; judge: Judge }) {
  const y = (z: number) => SVG_H / 2 - (Math.max(-Z_MAX, Math.min(Z_MAX, z)) / Z_MAX) * (SVG_H / 2 - 4);
  const step = SVG_W / Math.max(1, values.length - 1);
  const points = values.map((z, i) => `${(i * step).toFixed(1)},${y(z).toFixed(1)}`).join(' ');
  return (
    <svg
      className="ab-z"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <line className="ab-z__line" x1="0" x2={SVG_W} y1={y(CRITICAL_Z)} y2={y(CRITICAL_Z)} />
      <line className="ab-z__line" x1="0" x2={SVG_W} y1={y(-CRITICAL_Z)} y2={y(-CRITICAL_Z)} />
      <line className="ab-z__zero" x1="0" x2={SVG_W} y1={SVG_H / 2} y2={SVG_H / 2} />
      <polyline className="ab-z__path" points={points} />
      {judge === 'daily' &&
        values.map((z, i) =>
          Math.abs(z) >= CRITICAL_Z ? (
            <circle key={i} className="ab-z__hit" cx={(i * step).toFixed(1)} cy={y(z).toFixed(1)} r="3" />
          ) : null,
        )}
    </svg>
  );
}

const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '계산 불가');

export default function Simulator() {
  const [judge, setJudge] = useState<Judge>('fixed');
  const [record, setRecord] = useState<RecordMode>('expose');
  const [liftPct, setLiftPct] = useState(10);
  const [visitors, setVisitors] = useState(400);
  const [reachPct, setReachPct] = useState(50);
  const [seed, setSeed] = useState(7);

  const { chosen, nullRun } = useMemo(() => {
    const params: Params = {
      lift: liftPct / 100,
      visitorsPerDay: visitors,
      reach: reachPct / 100,
      judge,
      record,
      seed,
    };
    return { chosen: summarize(params), nullRun: summarize({ ...params, lift: 0 }) };
  }, [liftPct, visitors, reachPct, judge, record, seed]);

  return (
    <div className="ab-lab">
      <RadioGroup label="판정 방식" options={JUDGE_OPTIONS} value={judge} onValueChange={setJudge} />
      <p className="ab-lab__hint">{JUDGE_HINT[judge]}</p>

      <RadioGroup label="노출 기록 방식" options={RECORD_OPTIONS} value={record} onValueChange={setRecord} />
      <p className="ab-lab__hint">{RECORD_HINT[record]}</p>

      <div className="ab-lab__controls">
        <label className="ab-field">
          <span>실제 효과 {liftPct}% (상대)</span>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={liftPct}
            onChange={(e) => setLiftPct(Number(e.target.value))}
          />
        </label>
        <label className="ab-field">
          <span>하루 방문자 {visitors}명</span>
          <input
            type="range"
            min={100}
            max={1000}
            step={100}
            value={visitors}
            onChange={(e) => setVisitors(Number(e.target.value))}
          />
        </label>
        <label className="ab-field">
          <span>버튼이 보이는 페이지까지 간 비율 {reachPct}%</span>
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={reachPct}
            onChange={(e) => setReachPct(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="ab-lab__seed">
        <span>시드 {seed} · 같은 시드는 항상 같은 방문자 흐름이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="ab-lab__results" aria-label="결과">
        <Stat label="실제 효과를 찾아낸 실험" value={pct(chosen.significantRate)} />
        <Stat label="효과 없을 때 잘못 찾아낸 실험" value={pct(nullRun.significantRate)} tone="accent" />
        <Stat label="측정된 평균 효과" value={pct(chosen.measuredLiftAvg)} />
        <Stat
          label="유의하다고 나온 실험의 평균 효과"
          value={chosen.significantLiftAvg === null ? '없음' : pct(chosen.significantLiftAvg)}
        />
      </section>

      <section className="ab-lab__chart" aria-label="날짜별 z 값">
        <h3>첫 번째 실험의 날짜별 z 값</h3>
        <ZChart values={chosen.firstZPath} judge={judge} />
        <p className="ab-lab__note">
          선이 위아래 {CRITICAL_Z} 밖으로 나가면 유의하다고 판정해요. 기준 전환율은 {BASE_RATE * 100}%로 가정한
          예시예요.
        </p>
      </section>

      <p className="ab-lab__note">모든 수치는 예시예요. 실험 {chosen.runs}번을 같은 조건으로 돌린 평균이에요.</p>
    </div>
  );
}
