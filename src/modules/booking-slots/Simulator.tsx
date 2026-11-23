import { Alert, RadioGroup, Select, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  EXISTING,
  formatRange,
  formatTime,
  MODES,
  OPEN,
  REQUEST_LABELS,
  simulate,
  TIMINGS,
  timeOptions,
  type Interval,
  type Mode,
  type Outcome,
  type Timing,
} from './model';
import './Simulator.css';

const SPAN = OPEN.end - OPEN.start;
const pct = (m: number) => ((m - OPEN.start) / SPAN) * 100;
const HOUR_MARKS = [540, 720, 900, 1080];

const VERDICT_TAG: Record<Outcome['verdict'], { label: string; variant: 'accent' | 'neutral' | 'outline' }> = {
  created: { label: '201 저장', variant: 'outline' },
  overlap: { label: '201 · 겹침', variant: 'accent' },
  conflict: { label: '409', variant: 'neutral' },
};

const BAR_CLASS: Record<Outcome['verdict'], string> = {
  created: 'bk-bar bk-bar--ok',
  overlap: 'bk-bar bk-bar--double',
  conflict: 'bk-bar bk-bar--rejected',
};

interface TimeRangeFieldsProps {
  legend: string;
  value: Interval;
  onChange: (next: Interval) => void;
}

/** 시작과 끝을 30분 단위로 고르고, 끝이 시작보다 빠르지 않게 맞춰요 */
function TimeRangeFields({ legend, value, onChange }: TimeRangeFieldsProps) {
  return (
    <fieldset className="bk-fields">
      <legend>{legend}</legend>
      <Select
        native
        label="시작"
        options={timeOptions(OPEN.start, OPEN.end - 30)}
        value={String(value.start)}
        onChange={(s) => {
          const start = Number(s);
          onChange({ start, end: Math.max(value.end, start + 30) });
        }}
      />
      <Select
        native
        label="끝"
        options={timeOptions(value.start + 30)}
        value={String(value.end)}
        onChange={(e) => onChange({ start: value.start, end: Number(e) })}
      />
    </fieldset>
  );
}

interface TimelineProps {
  requests: readonly Interval[];
  outcomes: readonly Outcome[];
}

/** 기존 예약은 회색, 요청은 결과에 따라 색을 달리해요. 409 요청은 점선으로 남겨요 */
function Timeline({ requests, outcomes }: TimelineProps) {
  const rows = [
    ...EXISTING.map((b) => ({ key: b.owner, span: b, className: 'bk-bar bk-bar--existing' })),
    ...outcomes.map((o, i) => ({ key: REQUEST_LABELS[i], span: requests[i], className: BAR_CLASS[o.verdict] })),
  ];

  return (
    <div className="bk-timeline" role="img" aria-label="09시부터 18시까지 예약 배치">
      <div className="bk-timeline__axis" aria-hidden="true">
        {HOUR_MARKS.map((m) => (
          <span key={m} style={{ left: `${pct(m)}%` }}>
            {formatTime(m)}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="bk-timeline__row" key={row.key}>
          <span className="bk-timeline__name">{row.key}</span>
          <div className="bk-timeline__track">
            <span
              className={row.className}
              style={{ left: `${pct(row.span.start)}%`, width: `${pct(row.span.end) - pct(row.span.start)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Simulator() {
  const id = useId();
  const [mode, setMode] = useState<Mode>('none');
  const [timing, setTiming] = useState<Timing>('concurrent');
  const [first, setFirst] = useState<Interval>({ start: 840, end: 900 });
  const [second, setSecond] = useState<Interval>({ start: 870, end: 930 });

  const requests = [first, second];
  const result = simulate({ mode, timing, requests: [first, second] });

  const modeInfo = MODES.find((m) => m.id === mode);
  const created = result.outcomes.filter((o) => o.status === 201).length;
  const rejected = result.outcomes.filter((o) => o.status === 409).length;

  return (
    <div className="bk-lab">
      <RadioGroup
        label="겹침을 막는 방식"
        options={MODES.map((m) => ({ value: m.id, label: m.label }))}
        value={mode}
        onValueChange={(value) => setMode(value as Mode)}
      />
      <p className="bk-lab__summary">{modeInfo?.summary}</p>

      <RadioGroup
        label="두 요청이 들어오는 순서"
        options={TIMINGS.map((t) => ({ value: t.id, label: t.label }))}
        value={timing}
        onValueChange={(value) => setTiming(value as Timing)}
      />

      <div className="bk-lab__inputs">
        <TimeRangeFields legend={`${REQUEST_LABELS[0]} (새 예약)`} value={first} onChange={setFirst} />
        <TimeRangeFields legend={`${REQUEST_LABELS[1]} (새 예약)`} value={second} onChange={setSecond} />
      </div>

      <section className="bk-lab__results" aria-labelledby={`${id}-results`}>
        <h3 id={`${id}-results`}>결과</h3>
        <div className="bk-lab__stats">
          <Stat label="저장된 요청" value={created} unit="건" />
          <Stat label="409 실패" value={rejected} unit="건" tone={rejected > 0 ? 'accent' : 'ink'} />
          <Stat
            label="겹친 예약 쌍"
            value={result.overlapPairs}
            unit="쌍"
            tone={result.overlapPairs > 0 ? 'accent' : 'ink'}
          />
        </div>

        {result.overlapPairs > 0 && (
          <Alert tone="warning" title="같은 시간에 예약이 두 개 저장됐어요. 겹친 예약이 생겼어요." />
        )}

        <ol className="bk-lab__outcomes">
          {result.outcomes.map((o) => (
            <li key={o.label}>
              <Tag variant={VERDICT_TAG[o.verdict].variant}>{VERDICT_TAG[o.verdict].label}</Tag>
              <span>{o.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bk-lab__timeline" aria-labelledby={`${id}-tl`}>
        <h3 id={`${id}-tl`}>예약 배치 (09:00~18:00)</h3>
        <Timeline requests={requests} outcomes={result.outcomes} />
        <p className="bk-lab__note">
          점선은 409 로 막힌 요청이 잡으려 했던 구간이에요. 요청 A 는 {formatRange(first)}, 요청 B 는{' '}
          {formatRange(second)} 예요.
        </p>
      </section>

      <section className="bk-lab__free" aria-labelledby={`${id}-free`}>
        <h3 id={`${id}-free`}>남은 빈 시간</h3>
        {result.free.length === 0 ? (
          <p>빈 시간이 없어요. 영업시간이 모두 예약됐어요.</p>
        ) : (
          <ul>
            {result.free.map((w) => (
              <li key={w.start}>{formatRange(w)}</li>
            ))}
          </ul>
        )}
        <p className="bk-lab__note">
          빈 시간은 저장된 예약을 영업시간에서 뺀 값이에요. 시간은 감을 잡기 위한 예시예요.
        </p>
      </section>
    </div>
  );
}
