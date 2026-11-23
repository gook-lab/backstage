import { Alert, Button, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { DEFAULT_TTL, simulate, STRATEGIES, type Config, type Frame, type Strategy } from './model';
import './Simulator.css';

const VIEW_LABEL = { AVAILABLE: '비어 있어요', HELD: '보류 중', SOLD: '판매 완료' } as const;

const KIND_TAG: Record<Frame['kind'], { label: string; variant: 'accent' | 'neutral' | 'outline' }> = {
  info: { label: '요청', variant: 'neutral' },
  hold: { label: '보류', variant: 'outline' },
  released: { label: '만료 재배정', variant: 'outline' },
  conflict: { label: '409', variant: 'accent' },
  double: { label: '이중 예약', variant: 'accent' },
  sold: { label: '확정', variant: 'outline' },
  refund: { label: '환불', variant: 'neutral' },
};

const LOG_TAIL = 12;

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('naive');
  const [users, setUsers] = useState(30);
  const [seats, setSeats] = useState(10);
  const [expiry, setExpiry] = useState(true);
  const [seed, setSeed] = useState(7);
  const [cursor, setCursor] = useState<number | null>(null);

  const { frames } = useMemo(
    () => simulate({ strategy, users, seats, ttl: DEFAULT_TTL, expiry, seed } satisfies Config),
    [strategy, users, seats, expiry, seed],
  );
  const last = frames.length - 1;
  const at = Math.min(cursor ?? last, last);
  const frame = frames[at];
  const strategyInfo = STRATEGIES.find((s) => s.id === strategy);
  const changed = (fn: () => void) => {
    fn();
    setCursor(null);
  };
  const logFrames = frames
    .slice(1, at + 1)
    .slice(-LOG_TAIL)
    .reverse();

  return (
    <div className="cs-lab">
      <RadioGroup
        label="좌석을 잡는 방식"
        options={STRATEGIES.map((s) => ({ value: s.id, label: s.label }))}
        value={strategy}
        onValueChange={(value) => changed(() => setStrategy(value as Strategy))}
      />
      <p className="cs-lab__summary">{strategyInfo?.summary}</p>

      <div className="cs-lab__controls">
        <label className="cs-field">
          <span>
            동시에 누르는 사람 <strong>{users}명</strong>
          </span>
          <input
            type="range"
            min={2}
            max={200}
            step={1}
            value={users}
            onChange={(e) => changed(() => setUsers(Number(e.target.value)))}
          />
        </label>
        <label className="cs-field">
          <span>
            좌석 수 <strong>{seats}석</strong>
          </span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={seats}
            onChange={(e) => changed(() => setSeats(Number(e.target.value)))}
          />
        </label>
        <label className="cs-check">
          <input type="checkbox" checked={expiry} onChange={(e) => changed(() => setExpiry(e.target.checked))} />
          보류 만료 켜기 (결제 안 하면 {DEFAULT_TTL} 틱 뒤 풀려요)
        </label>
        <Button variant="secondary" size="sm" onClick={() => changed(() => setSeed((s) => s + 1))}>
          다른 순서로 다시 돌리기
        </Button>
      </div>

      <div className="cs-lab__stats">
        <Stat label="이중 예약" value={frame.stats.doubleBookings} />
        <Stat label="409 실패" value={frame.stats.conflicts} />
        <Stat label="결제 확정" value={frame.stats.sold} />
        <Stat label="환불" value={frame.stats.refunds} />
        <Stat label="DB 왕복" value={frame.stats.roundTrips} />
      </div>

      {frame.stats.doubleBookings > 0 && (
        <Alert tone="warning" title="같은 좌석이 두 사람에게 넘어갔어요. 나중에 쓴 사람이 앞선 보류를 덮어썼어요." />
      )}

      <section className="cs-lab__seats" aria-labelledby="cs-seats-title">
        <h3 id="cs-seats-title">좌석 배치</h3>
        <ul className="cs-seats">
          {frame.seats.map((seat, i) => (
            <li
              key={i}
              className={`cs-seat cs-seat--${seat.view.toLowerCase()}`}
              aria-label={`${i + 1}번 좌석: ${VIEW_LABEL[seat.view]}${seat.holder === null ? '' : `, 사용자 ${seat.holder + 1}`}`}
            >
              <span className="cs-seat__no">{i + 1}</span>
              <span className="cs-seat__state">{VIEW_LABEL[seat.view]}</span>
              {seat.holder !== null && <span className="cs-seat__who">사용자 {seat.holder + 1}</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="cs-lab__scrub">
        <label className="cs-field">
          <span>
            진행 단계{' '}
            <strong>
              {at} / {last}
            </strong>
          </span>
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={at}
            aria-valuetext={`${at}단계 중 ${last}단계`}
            onChange={(e) => setCursor(Number(e.target.value))}
          />
        </label>
        <p className="cs-lab__narration" aria-live="polite">
          {frame.text}
        </p>
      </div>

      <section className="cs-lab__log" aria-labelledby="cs-log-title">
        <h3 id="cs-log-title">최근 기록</h3>
        {logFrames.length === 0 ? (
          <p>아직 기록이 없어요. 진행 단계를 움직여 보세요.</p>
        ) : (
          <ol>
            {logFrames.map((entry, i) => (
              <li key={i}>
                <Tag variant={KIND_TAG[entry.kind].variant}>{KIND_TAG[entry.kind].label}</Tag> {entry.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="cs-lab__actions">
        <Button variant="ghost" size="sm" onClick={() => setCursor(0)}>
          처음으로
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(null)}>
          끝까지 보기
        </Button>
      </div>
    </div>
  );
}
