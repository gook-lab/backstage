import { Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  GATEWAY_MAX,
  GATEWAY_MIN,
  JOB_MAX,
  JOB_MIN,
  MODE_LABEL,
  MODES,
  POLL_MAX,
  POLL_MIN,
  type Mode,
  type Outcome,
  type Params,
  type Poll,
  run,
} from './model';
import './Simulator.css';

const POLL_STATUS_LABEL: Record<Poll['status'], string> = {
  queued: '대기열',
  running: '진행 중',
  succeeded: '완료',
};

const SHOWN_POLLS = 8;

function verdict(mode: Mode, o: Outcome, p: Params): string {
  if (mode === 'sync') {
    if (o.timedOut) {
      return `504를 받았어요. 서버 작업은 ${o.serverDoneAt}초에 끝나지만 화면은 ${o.feDoneAt}초에 멈춰요.`;
    }
    return `요청 하나로 ${o.resultAt}초에 결과를 받았어요.`;
  }
  const lag = (o.resultAt ?? 0) - o.serverDoneAt;
  const late = lag === 0 ? '작업이 끝나자마자 봤어요.' : `작업이 끝난 뒤 ${lag}초 늦게 봤어요.`;
  return `접수 응답은 바로 받았어요. 조회 ${o.requests - 1}번 끝에 ${o.resultAt}초에 결과를 봤어요. ${late} 간격은 ${p.pollSeconds}초예요.`;
}

function ModeCard({ mode, outcome, params }: { mode: Mode; outcome: Outcome; params: Params }) {
  const hidden = outcome.polls.length - SHOWN_POLLS;
  return (
    <section className="ba-card" aria-label={`${MODE_LABEL[mode]} 결과`}>
      <h3 className="ba-card__title">
        {MODE_LABEL[mode]}
        {outcome.timedOut && <Tag variant="accent">504</Tag>}
      </h3>
      <div className="ba-card__stats">
        <Stat label="요청 수" value={outcome.requests} unit="번" />
        <Stat
          label="결과를 보는 시점"
          value={outcome.resultAt === null ? '없음' : outcome.resultAt}
          unit={outcome.resultAt === null ? undefined : '초'}
          tone={outcome.resultAt === null ? 'accent' : 'ink'}
        />
        <Stat label="화면이 멈추는 시점" value={outcome.feDoneAt} unit="초" />
      </div>
      <p className="ba-card__verdict">{verdict(mode, outcome, params)}</p>
      {outcome.retryRisk && (
        <p className="ba-card__warn">
          다시 누르면 같은 작업이 한 번 더 돌 수 있어요. 이미 접수된 작업이 있는지 먼저 확인해요.
        </p>
      )}
      {mode === 'poll' && (
        <>
          <h4 className="ba-card__subtitle">조회 기록</h4>
          <ol className="ba-timeline">
            {outcome.polls.slice(0, SHOWN_POLLS).map((poll, i) => (
              <li key={i}>
                <span className="ba-timeline__at">{poll.at}초</span>
                <span>{i === 0 ? '접수 응답 (202)' : `조회 응답 (200) · ${POLL_STATUS_LABEL[poll.status]}`}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && <p className="ba-card__more">외 {hidden}번 더 조회해요.</p>}
        </>
      )}
    </section>
  );
}

export default function Simulator() {
  const [jobSeconds, setJobSeconds] = useState(45);
  const [pollSeconds, setPollSeconds] = useState(5);
  const [gatewaySeconds, setGatewaySeconds] = useState(30);

  const params: Params = { jobSeconds, pollSeconds, gatewaySeconds };

  return (
    <div className="ba-lab">
      <div className="ba-lab__controls">
        <label className="ba-field">
          <span>작업 소요 시간 {jobSeconds}초</span>
          <input
            type="range"
            min={JOB_MIN}
            max={JOB_MAX}
            step={5}
            value={jobSeconds}
            onChange={(e) => setJobSeconds(Number(e.target.value))}
          />
        </label>
        <label className="ba-field">
          <span>폴링 간격 {pollSeconds}초</span>
          <input
            type="range"
            min={POLL_MIN}
            max={POLL_MAX}
            step={1}
            value={pollSeconds}
            onChange={(e) => setPollSeconds(Number(e.target.value))}
          />
        </label>
        <label className="ba-field">
          <span>게이트웨이 제한 시간 {gatewaySeconds}초</span>
          <input
            type="range"
            min={GATEWAY_MIN}
            max={GATEWAY_MAX}
            step={5}
            value={gatewaySeconds}
            onChange={(e) => setGatewaySeconds(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="ba-lab__cards">
        {MODES.map((mode) => (
          <ModeCard key={mode} mode={mode} outcome={run(mode, params)} params={params} />
        ))}
      </div>

      <p className="ba-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
