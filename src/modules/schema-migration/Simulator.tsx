import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  type ComboStat,
  DEFAULT_PARAMS,
  HORIZON,
  NEW_BUNDLE_LABEL,
  type Params,
  RELEASE_TICK,
  SHAPE_LABEL,
  SHAPES,
  STRATEGIES,
  STRATEGY_LABEL,
  type Strategy,
  mixAt,
  simulate,
  type ResponseShape,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  'big-bang':
    '서버와 FE 를 같은 날 한 번에 바꿔요. 배포 중에는 옛 서버와 새 서버가 섞여 응답하고, 열어 둔 탭은 옛 번들을 계속 써요.',
  staged:
    '먼저 응답에 두 필드를 함께 담고(펼치기), 새 FE 가 두 필드 중 있는 쪽을 읽게 한 뒤, 옛 필드를 빼요(줄이기). 옛 번들을 쥔 손님이 남아 있는 동안에는 줄이지 않아요.',
};

const SVG_W = 300;
const SVG_H = 72;

function FailBars({ values, tick }: { values: readonly number[]; tick: number }) {
  const max = Math.max(1, ...values);
  const barW = SVG_W / values.length;
  return (
    <svg
      className="sm-bars"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {values.map((v, i) => {
        const h = (v / max) * (SVG_H - 4);
        return (
          <rect
            key={i}
            className={i === tick ? 'sm-bars__bar sm-bars__bar--now' : 'sm-bars__bar'}
            x={i * barW + 0.5}
            y={SVG_H - h}
            width={Math.max(1, barW - 1)}
            height={h}
          />
        );
      })}
    </svg>
  );
}

function comboText(stat: ComboStat): string {
  if (stat.total === 0) return '요청 없음';
  if (stat.failed === 0) return `정상 · ${stat.total}건`;
  return `깨짐 · ${stat.failed}건 / ${stat.total}건`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Simulator() {
  const chartId = useId();
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_PARAMS.strategy);
  const [rollTicks, setRollTicks] = useState(DEFAULT_PARAMS.rollTicks);
  const [feLagTicks, setFeLagTicks] = useState(DEFAULT_PARAMS.feLagTicks);
  const [tailPct, setTailPct] = useState(DEFAULT_PARAMS.tail * 100);
  const [contractTick, setContractTick] = useState(DEFAULT_PARAMS.contractTick);
  const [seed, setSeed] = useState(DEFAULT_PARAMS.seed);
  const [tick, setTick] = useState(20);

  const params: Params = {
    strategy,
    rollTicks,
    feLagTicks,
    tail: tailPct / 100,
    contractTick,
    seed,
  };
  const result = simulate(params);
  const mix = mixAt(params, tick);

  return (
    <div className="sm-lab">
      <RadioGroup
        label="배포 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="sm-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <div className="sm-lab__controls">
        <label className="sm-field">
          <span>서버 롤링 기간 {rollTicks}틱</span>
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={rollTicks}
            onChange={(e) => setRollTicks(Number(e.target.value))}
          />
        </label>
        <label className="sm-field">
          <span>옛 번들 정리 기간 {feLagTicks}틱</span>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={feLagTicks}
            onChange={(e) => setFeLagTicks(Number(e.target.value))}
          />
          <small>새 FE 를 낸 뒤 옛 번들을 쥔 손님이 줄어드는 속도예요.</small>
        </label>
        <label className="sm-field">
          <span>오래 열린 탭 {tailPct}%</span>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={tailPct}
            onChange={(e) => setTailPct(Number(e.target.value))}
          />
          <small>새 번들을 받지 않고 탭을 계속 열어 두는 손님 비율이에요.</small>
        </label>
        <label className="sm-field">
          <span>옛 필드를 빼는 시각 {contractTick}틱</span>
          <input
            type="range"
            min={RELEASE_TICK}
            max={HORIZON - 5}
            step={1}
            value={contractTick}
            disabled={strategy === 'big-bang'}
            onChange={(e) => setContractTick(Number(e.target.value))}
          />
          {strategy === 'big-bang' && <small>한 번에 바꾸기는 줄이는 단계가 따로 없어요.</small>}
        </label>
      </div>

      <div className="sm-lab__seed">
        <span>시드 {seed} · 같은 시드는 항상 같은 손님 흐름이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="sm-lab__results" aria-label="결과">
        <Stat
          label="깨진 요청 / 전체"
          value={`${result.failed} / ${result.total}`}
          tone={result.failed > 0 ? 'accent' : 'ink'}
        />
        <Stat
          label="깨진 구간"
          value={result.firstFail === null ? '없음' : `${result.firstFail}–${result.lastFail}틱`}
        />
      </section>

      {result.failed > 0 && (
        <p className="sm-lab__alarm" role="status">
          요청 {result.failed}건이 깨졌어요. 응답에 없는 필드를 읽는 번들이 있었어요.
        </p>
      )}

      <section className="sm-lab__bars" aria-labelledby={`${chartId}-bars`}>
        <h3 id={`${chartId}-bars`}>틱마다 깨진 요청 수</h3>
        <FailBars values={result.failedByTick} tick={tick} />
        <p className="sm-lab__note">
          배포는 {RELEASE_TICK}틱에 시작해요. 틱 {tick} 에는 {result.failedByTick[tick]}건이 깨졌어요.
        </p>
      </section>

      <section className="sm-lab__timeline" aria-labelledby={`${chartId}-tl`}>
        <h3 id={`${chartId}-tl`}>시각별 배포 상태</h3>
        <label className="sm-field">
          <span>
            틱 {tick} / {HORIZON - 1}
          </span>
          <input
            type="range"
            min={0}
            max={HORIZON - 1}
            step={1}
            value={tick}
            onChange={(e) => setTick(Number(e.target.value))}
          />
        </label>
        <dl className="sm-lab__now">
          <div>
            <dt>옛 서버 응답</dt>
            <dd>{pct(mix.old)}</dd>
          </div>
          <div>
            <dt>펼친 서버 응답</dt>
            <dd>{pct(mix.both)}</dd>
          </div>
          <div>
            <dt>새 서버 응답</dt>
            <dd>{pct(mix.renamed)}</dd>
          </div>
          <div>
            <dt>옛 번들 손님</dt>
            <dd>{pct(mix.oldClient)}</dd>
          </div>
        </dl>
      </section>

      <table className="sm-table">
        <caption>응답 모양 × FE 번들 조합별 요청 (전 기간 합계)</caption>
        <thead>
          <tr>
            <th scope="col">서버 응답</th>
            <th scope="col">옛 FE 번들 (nickname 을 읽어요)</th>
            <th scope="col">{NEW_BUNDLE_LABEL[strategy]}</th>
          </tr>
        </thead>
        <tbody>
          {SHAPES.map((shape: ResponseShape) => (
            <tr key={shape}>
              <th scope="row">{SHAPE_LABEL[shape]}</th>
              <td data-broken={result.combos[shape].old.failed > 0 ? 'true' : undefined}>
                {comboText(result.combos[shape].old)}
              </td>
              <td data-broken={result.combos[shape].new.failed > 0 ? 'true' : undefined}>
                {comboText(result.combos[shape].new)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
