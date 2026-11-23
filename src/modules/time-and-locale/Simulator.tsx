import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DAY_RULE_LABEL,
  type DayRule,
  type EventDraft,
  dayBucket,
  formatZoned,
  gapsInHours,
  instantSeenBy,
  intendedInstant,
  SCHEDULE_TIME,
  SIMULATOR_DAYS,
  type ScheduleMode,
  scheduleFires,
  STORAGE_OPTIONS,
  type Storage,
  wireValue,
  ZONES,
  type ZoneId,
  zoneLabel,
} from './model';
import './Simulator.css';

type SimDay = (typeof SIMULATOR_DAYS)[number];
const TIMES = ['02:30', '09:00', '10:00'] as const;
type SimTime = (typeof TIMES)[number];

const ZONE_OPTIONS: { value: ZoneId; label: string }[] = ZONES.map((z) => ({ value: z.id, label: z.label }));
const DAY_OPTIONS: { value: SimDay; label: string }[] = SIMULATOR_DAYS.map((d) => ({ value: d, label: d }));
const TIME_OPTIONS: { value: SimTime; label: string }[] = TIMES.map((t) => ({ value: t, label: t }));
const SCHEDULE_MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: 'wall', label: '시간대 이름으로 예약' },
  { value: 'fixed', label: '처음 날 오프셋 고정' },
];
const DAY_RULES: readonly DayRule[] = ['utc', 'author', 'viewer'];

/** 2026-03-08T01:00:00Z 처럼 밀리초가 0인 UTC 표기 */
const utcShort = (d: Date) => d.toISOString().replace('.000Z', 'Z');

export default function Simulator() {
  const [authorZone, setAuthorZone] = useState<ZoneId>('Asia/Seoul');
  const [day, setDay] = useState<SimDay>('2026-03-08');
  const [time, setTime] = useState<SimTime>('10:00');
  const [storage, setStorage] = useState<Storage>('naive');
  const [viewerZone, setViewerZone] = useState<ZoneId>('America/New_York');
  const [scheduleZone, setScheduleZone] = useState<ZoneId>('America/New_York');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('wall');

  const event: EventDraft = { authorZone, wall: `${day}T${time}` };
  const intended = intendedInstant(event);
  const seen = instantSeenBy(event, storage, viewerZone);
  const matches = seen.getTime() === intended.getTime();

  const fires = scheduleFires(SIMULATOR_DAYS, scheduleZone, scheduleMode);
  const gaps = gapsInHours(fires);

  return (
    <div className="tl-lab">
      <div className="tl-lab__controls">
        <RadioGroup label="작성자 시간대" options={ZONE_OPTIONS} value={authorZone} onValueChange={setAuthorZone} />
        <RadioGroup label="작성 날짜" options={DAY_OPTIONS} value={day} onValueChange={setDay} />
        <RadioGroup label="작성 시각" options={TIME_OPTIONS} value={time} onValueChange={setTime} />
        <RadioGroup
          label="서버가 내려 주는 방식"
          options={STORAGE_OPTIONS}
          value={storage}
          onValueChange={setStorage}
        />
        <RadioGroup label="보는 사람 시간대" options={ZONE_OPTIONS} value={viewerZone} onValueChange={setViewerZone} />
      </div>

      <section className="tl-lab__panel" aria-label="이벤트 표시">
        <dl className="tl-lab__facts">
          <div>
            <dt>서버가 보낸 값</dt>
            <dd>
              <code>{wireValue(event, storage)}</code>
            </dd>
          </div>
          <div>
            <dt>보는 사람 기기가 해석한 순간</dt>
            <dd>
              <code>{utcShort(seen)}</code>
            </dd>
          </div>
          <div>
            <dt>화면 표시 ({zoneLabel(viewerZone)})</dt>
            <dd>{formatZoned(seen, viewerZone)}</dd>
          </div>
        </dl>

        <p className="tl-lab__verdict" data-match={matches ? 'same' : 'diff'}>
          {matches ? '작성자가 뜻한 순간과 같아요.' : '작성자가 뜻한 순간과 달라요.'}
        </p>
        <p className="tl-lab__hint">
          {storage === 'naive'
            ? '오프셋이 없어서 보는 사람 기기가 자기 시간대로 읽었어요. 화면 숫자는 같아 보여도 가리키는 순간이 달라요.'
            : '오프셋이 있어서 누가 읽어도 같은 순간을 가리켜요. 화면 숫자만 보는 사람의 시간대로 바뀌어요.'}
        </p>

        <table className="tl-lab__table">
          <caption>일별 집계에서 들어가는 날짜</caption>
          <thead>
            <tr>
              <th scope="col">집계 기준</th>
              <th scope="col">날짜</th>
            </tr>
          </thead>
          <tbody>
            {DAY_RULES.map((rule) => (
              <tr key={rule}>
                <td>{DAY_RULE_LABEL[rule]}</td>
                <td>{dayBucket(seen, rule, event, viewerZone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tl-lab__panel" aria-label="예약 발송">
        <div className="tl-lab__controls">
          <RadioGroup label="예약 시간대" options={ZONE_OPTIONS} value={scheduleZone} onValueChange={setScheduleZone} />
          <RadioGroup
            label="예약 방식"
            options={SCHEDULE_MODE_OPTIONS}
            value={scheduleMode}
            onValueChange={setScheduleMode}
          />
        </div>

        <table className="tl-lab__table">
          <caption>
            매일 {SCHEDULE_TIME} 알림 · {zoneLabel(scheduleZone)} 기준
          </caption>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">예약 지역 시각</th>
              <th scope="col">발송 순간 (UTC)</th>
              <th scope="col">앞 알림과 간격</th>
            </tr>
          </thead>
          <tbody>
            {SIMULATOR_DAYS.map((d, i) => (
              <tr key={d}>
                <td>{d}</td>
                <td>{formatZoned(fires[i], scheduleZone)}</td>
                <td>
                  <code>{utcShort(fires[i])}</code>
                </td>
                <td>{gaps[i] === null ? '-' : `${gaps[i]}시간`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tl-lab__hint">
          시간대 이름은 날마다 그 지역 규칙을 다시 계산해요. 고정 오프셋은 처음 계산한 값을 그대로 써서, 서머타임이
          바뀌는 날 한 시간 어긋나요.
        </p>
      </section>

      <p className="tl-lab__hint">수치는 감을 잡기 위한 예시예요. 계산은 브라우저의 Intl API로 해요.</p>
    </div>
  );
}
