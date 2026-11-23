import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  DEFAULT_QUERY,
  GUARD_LABEL,
  GUARDS,
  type RequestStatus,
  STRATEGIES,
  STRATEGY_LABEL,
  type StaleGuard,
  type Strategy,
  simulate,
  WINDOW_MAX,
  WINDOW_MIN,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  every: '글자를 칠 때마다 요청해요. 입력 글자 수만큼 서버에 요청이 가요.',
  debounce: '입력이 잠깐 멈춘 뒤 한 번만 요청해요. 멈추는 시간이 간격보다 길어야 보내요.',
  throttle: '정해진 간격마다 한 번씩 요청해요. 입력이 계속돼도 간격당 최대 한 번이에요.',
};

const GUARD_HINT: Record<StaleGuard, string> = {
  none: '응답이 온 순서대로 화면에 그려요. 먼저 보낸 요청이 늦게 오면 낡은 결과가 최신 결과를 덮어요.',
  seq: '요청마다 순번을 붙이고, 화면에 그린 순번보다 오래된 응답은 버려요.',
  abort: '새 요청을 보내기 전에 기다리는 이전 요청을 끊어요. 끊긴 요청의 응답은 화면에 반영되지 않아요.',
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  shown: '화면에 반영',
  'stale-shown': '낡은 응답이 덮음',
  ignored: '낡아서 무시',
  cancelled: '취소됨',
};

const SVG_W = 320;
const ROW_H = 22;

function Timeline({
  requests,
  keys,
  endAt,
}: {
  requests: ReturnType<typeof simulate>['requests'];
  keys: ReturnType<typeof simulate>['keys'];
  endAt: number;
}) {
  const span = Math.max(1, endAt);
  const x = (t: number) => (t / span) * (SVG_W - 8) + 4;
  const h = ROW_H * requests.length + 18;
  return (
    <svg
      className="sa-timeline"
      viewBox={`0 0 ${SVG_W} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {keys.map((k, i) => (
        <line key={`k${i}`} className="sa-timeline__key" x1={x(k.at)} x2={x(k.at)} y1={0} y2={12} />
      ))}
      {requests.map((r, row) => {
        const y = 18 + row * ROW_H + ROW_H / 2;
        return (
          <g key={r.id} className={`sa-timeline__row sa-timeline__row--${r.status}`}>
            <line x1={x(r.sentAt)} x2={x(r.arriveAt)} y1={y} y2={y} />
            <circle cx={x(r.sentAt)} cy={y} r={2.5} />
            <circle cx={x(r.arriveAt)} cy={y} r={3.5} />
          </g>
        );
      })}
    </svg>
  );
}

export default function Simulator() {
  const captionId = useId();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [strategy, setStrategy] = useState<Strategy>('every');
  const [windowMs, setWindowMs] = useState(300);
  const [guard, setGuard] = useState<StaleGuard>('none');
  const [seed, setSeed] = useState(3);

  const typed = query.trim();
  const result = simulate({ query: typed, strategy, windowMs, guard, seed });
  const sendsPerKey = result.typedCount === 0 ? 0 : result.sent / result.typedCount;

  let verdict: string;
  if (typed.length === 0) {
    verdict = '검색어를 입력해 주세요.';
  } else if (!result.correct) {
    verdict = `화면에 남은 결과는 "${result.shownQuery ?? ''}" 예요. 입력한 "${result.finalQuery}" 와 달라요.`;
  } else if (result.staleShown > 0) {
    verdict = '중간에 낡은 결과가 잠깐 보였지만, 마지막에는 입력한 검색어의 결과가 남았어요.';
  } else {
    verdict = '낡은 응답 없이 마지막 검색어의 결과가 남았어요.';
  }

  return (
    <div className="sa-lab">
      <label className="sa-field">
        <span>검색어 (직접 바꿔 볼 수 있어요)</span>
        <input
          type="text"
          value={query}
          maxLength={12}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${captionId}-query`}
        />
        <small id={`${captionId}-query`}>12글자까지 입력할 수 있어요. 한 글자씩 입력한 것으로 시뮬레이션해요.</small>
      </label>

      <RadioGroup
        label="요청을 보내는 시점"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="sa-lab__hint">{STRATEGY_HINT[strategy]}</p>

      {strategy !== 'every' && (
        <label className="sa-field">
          <span>{strategy === 'debounce' ? `멈춤 대기 ${windowMs}ms` : `스로틀 간격 ${windowMs}ms`}</span>
          <input
            type="range"
            min={WINDOW_MIN}
            max={WINDOW_MAX}
            step={50}
            value={windowMs}
            onChange={(e) => setWindowMs(Number(e.target.value))}
          />
        </label>
      )}

      <RadioGroup
        label="늦게 온 낡은 응답 처리"
        options={GUARDS.map((g) => ({ value: g, label: GUARD_LABEL[g] }))}
        value={guard}
        onValueChange={setGuard}
      />
      <p className="sa-lab__hint">{GUARD_HINT[guard]}</p>

      <div className="sa-lab__seed">
        <span>
          시드 {seed} · 같은 시드는 같은 타이핑 속도와 응답 지연을 써요. 전략만 바꾸면 같은 조건으로 비교돼요.
        </span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 지연으로 다시 돌리기
        </Button>
      </div>

      <section className="sa-lab__results" aria-label="결과">
        <Stat label="보낸 요청 / 입력 글자" value={`${result.sent} / ${result.typedCount}`} />
        <Stat label="입력 글자당 요청" value={sendsPerKey.toFixed(2)} unit="건" />
        <Stat label="취소한 요청" value={result.cancelled} unit="건" />
        <Stat
          label="낡은 응답이 덮은 횟수"
          value={result.staleShown}
          unit="번"
          tone={result.staleShown > 0 ? 'accent' : 'ink'}
        />
      </section>

      <p className="sa-lab__verdict" role="status" data-correct={result.correct ? 'yes' : 'no'}>
        {verdict}
      </p>

      <section className="sa-lab__timeline" aria-labelledby={`${captionId}-timeline`}>
        <h3 id={`${captionId}-timeline`}>요청 시각과 응답 도착 (ms)</h3>
        {result.requests.length === 0 ? (
          <p className="sa-lab__note">보낸 요청이 없어요.</p>
        ) : (
          <Timeline requests={result.requests} keys={result.keys} endAt={result.endAt} />
        )}
        <p className="sa-lab__note">
          위 줄은 입력 시각(세로 눈금), 아래 줄은 요청 하나의 전송부터 도착까지예요. 먼저 보낸 요청이 나중에 도착하면
          낡은 응답이 생겨요.
        </p>
      </section>

      {result.requests.length > 0 && (
        <table className="sa-lab__table">
          <caption>요청 기록 (보낸 순서)</caption>
          <thead>
            <tr>
              <th scope="col">순번</th>
              <th scope="col">검색어</th>
              <th scope="col">보낸 시각</th>
              <th scope="col">도착 시각</th>
              <th scope="col">화면에서</th>
            </tr>
          </thead>
          <tbody>
            {result.requests.map((r) => (
              <tr key={r.id} data-status={r.status}>
                <td>{r.id}</td>
                <td>{r.query}</td>
                <td>{r.sentAt}</td>
                <td>{r.arriveAt}</td>
                <td>{STATUS_LABEL[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.shownQuery !== null && (
        <p className="sa-lab__note">
          화면에 남은 "{result.shownQuery}" 결과는 예시 데이터 기준 {result.shownHits}건이에요.
        </p>
      )}
    </div>
  );
}
