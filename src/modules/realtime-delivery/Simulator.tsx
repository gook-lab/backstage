import { Alert, Button, Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { type RealtimeConfig, type Strategy, simulate, simulateAll } from './model';
import './Simulator.css';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'short', label: '짧은 폴링' },
  { value: 'long', label: '롱 폴링' },
  { value: 'sse', label: 'SSE' },
  { value: 'ws', label: 'WebSocket' },
];

const STRATEGY_NAME: Record<Strategy, string> = {
  short: '짧은 폴링',
  long: '롱 폴링',
  sse: 'SSE',
  ws: 'WebSocket',
};

const fmtCount = (n: number) => n.toLocaleString('ko-KR');
const fmtDelay = (ms: number | null) => (ms === null ? '-' : `${(ms / 1000).toFixed(1)}초`);

export default function Simulator() {
  const [clients, setClients] = useState(10);
  const [eventsPerMin, setEventsPerMin] = useState(60);
  const [pollSec, setPollSec] = useState(10);
  const [dropOn, setDropOn] = useState(true);
  const [resume, setResume] = useState(false);
  const [seed, setSeed] = useState(7);
  const [focus, setFocus] = useState<Strategy>('short');

  const cfg: RealtimeConfig = { clients, eventsPerMin, pollSec, dropOn, resume, seed };
  const rows = simulateAll(cfg);
  const focused = rows.find((r) => r.strategy === focus) ?? rows[0];
  const withoutResume = simulate(focus, { ...cfg, resume: false });
  const withResume = simulate(focus, { ...cfg, resume: true });
  const missedNow = focused.missed;

  return (
    <div className="rt">
      <section className="rt-part" aria-labelledby="rt-setup-title">
        <h3 id="rt-setup-title" className="rt-part__title">
          1 · 같은 이벤트 흐름, 네 가지 방식
        </h3>
        <p className="rt-hint">
          10분 동안 이벤트가 무작위 클라이언트에게 도착해요. 같은 시드에서는 네 방식이 같은 이벤트를 받아요. 하트비트와
          인증 같은 부가 트래픽은 세지 않아요.
        </p>

        <div className="rt-sliders">
          <label className="rt-slider">
            <span>클라이언트 {fmtCount(clients)}명</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
            />
          </label>
          <label className="rt-slider">
            <span>이벤트 {fmtCount(eventsPerMin)}건 / 분</span>
            <input
              type="range"
              min={6}
              max={240}
              step={6}
              value={eventsPerMin}
              onChange={(e) => setEventsPerMin(Number(e.target.value))}
            />
          </label>
          <label className="rt-slider">
            <span>짧은 폴링 간격 P · {pollSec}초</span>
            <input
              type="range"
              min={2}
              max={30}
              step={2}
              value={pollSec}
              onChange={(e) => setPollSec(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="rt-toggles">
          <Checkbox label="중간에 90초 끊김" checked={dropOn} onCheckedChange={(v) => setDropOn(v === true)} />
          <Checkbox
            label="재연결 때 놓친 구간 이어받기"
            hint="Last-Event-ID 나 커서. 폴링은 항상 커서로 물어요."
            checked={resume}
            onCheckedChange={(v) => setResume(v === true)}
          />
        </div>

        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 무작위 흐름 보기
        </Button>
      </section>

      <section className="rt-part" aria-labelledby="rt-table-title">
        <h3 id="rt-table-title" className="rt-part__title">
          2 · 서버가 치르는 비용과 받는 지연
        </h3>
        <div className="rt-table-wrap">
          <table className="rt-table">
            <thead>
              <tr>
                <th scope="col">방식</th>
                <th scope="col">요청 / 분</th>
                <th scope="col">평균 지연</th>
                <th scope="col">열린 연결</th>
                <th scope="col">빈 응답</th>
                <th scope="col">놓친 이벤트</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.strategy} className={r.strategy === focus ? 'rt-row rt-row--focus' : 'rt-row'}>
                  <th scope="row">{STRATEGY_NAME[r.strategy]}</th>
                  <td>{r.requestsPerMin.toFixed(1)}</td>
                  <td>{fmtDelay(r.avgDelayMs)}</td>
                  <td>{fmtCount(r.openConnections)}</td>
                  <td>
                    {fmtCount(r.emptyResponses)}회 ({Math.round(r.emptyRatio * 100)}%)
                  </td>
                  <td>{fmtCount(r.missed)}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rt-hint">
          이벤트 {fmtCount(focused.events)}개 중 {fmtCount(focused.delivered)}개가 도착했어요. 전체 10분 기준이에요.
        </p>
      </section>

      <section className="rt-part" aria-labelledby="rt-focus-title">
        <h3 id="rt-focus-title" className="rt-part__title">
          3 · 자세히 볼 방식
        </h3>
        <RadioGroup label="방식" options={STRATEGY_OPTIONS} value={focus} onValueChange={setFocus} />

        <p className="rt-summary" aria-live="polite">
          {STRATEGY_NAME[focused.strategy]}: 평균 지연 {fmtDelay(focused.avgDelayMs)}, 열린 연결{' '}
          {fmtCount(focused.openConnections)}개, 요청 {focused.requestsPerMin.toFixed(1)}건 / 분.
        </p>

        {dropOn ? (
          <div className="rt-stats">
            <Stat label="끊김 구간 · 재개 없이 놓침" value={fmtCount(withoutResume.missed)} unit="개" />
            <Stat label="끊김 구간 · 재개로 놓침" value={fmtCount(withResume.missed)} unit="개" />
          </div>
        ) : null}

        <Alert
          tone={missedNow > 0 ? 'warning' : 'success'}
          title={
            missedNow > 0
              ? `${STRATEGY_NAME[focused.strategy]}는 끊긴 동안의 이벤트 ${fmtCount(missedNow)}개를 놓쳤어요.`
              : `${STRATEGY_NAME[focused.strategy]}는 이벤트를 하나도 놓치지 않았어요.`
          }
        />
      </section>
    </div>
  );
}
