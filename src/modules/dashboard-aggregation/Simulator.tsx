import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { type Bucket, type Query, type Range, runQuery, type Strategy, type Zone, KRW } from './model';
import './Simulator.css';

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '7', label: '최근 7일' },
  { value: '30', label: '최근 30일' },
  { value: '90', label: '최근 90일' },
];

const BUCKET_OPTIONS: { value: Bucket; label: string }[] = [
  { value: 'hour', label: '시' },
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
];

const ZONE_OPTIONS: { value: Zone; label: string }[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Seoul', label: '서울 (UTC+9)' },
];

const STRATEGY_OPTIONS: { value: Strategy; label: string; hint: string }[] = [
  { value: 'raw', label: '매번 원본', hint: '차트를 열 때마다 주문 행을 전부 세요.' },
  { value: 'rollup', label: '일별 롤업', hint: '끝난 날의 합계만 읽어요. 오늘은 아직 없어요.' },
  { value: 'rollup-today', label: '롤업 + 오늘만 원본', hint: '끝난 날은 롤업, 오늘만 주문 행에서 세요.' },
];

const DEFAULT_QUERY: Query = {
  range: 90,
  bucket: 'day',
  zone: 'Asia/Seoul',
  strategy: 'raw',
  fillGaps: false,
  injectLate: false,
};

export default function Simulator() {
  const [query, setQuery] = useState<Query>(DEFAULT_QUERY);
  const result = useMemo(() => runQuery(query), [query]);

  const update = (patch: Partial<Query>) => setQuery((prev) => ({ ...prev, ...patch }));

  const max = Math.max(1, ...result.points.map((p) => p.value));
  const strategyHint = STRATEGY_OPTIONS.find((o) => o.value === query.strategy)?.hint;

  return (
    <div className="da-lab">
      <div className="da-lab__controls">
        <RadioGroup
          label="기간"
          options={RANGE_OPTIONS}
          value={String(query.range)}
          onValueChange={(v) => update({ range: Number(v) as Range })}
        />
        <RadioGroup
          label="버킷 크기"
          options={BUCKET_OPTIONS}
          value={query.bucket}
          onValueChange={(v) => update({ bucket: v as Bucket })}
        />
        <RadioGroup
          label="시간대"
          options={ZONE_OPTIONS}
          value={query.zone}
          onValueChange={(v) => update({ zone: v as Zone })}
        />
        <RadioGroup
          label="집계 방식"
          options={STRATEGY_OPTIONS.map(({ value, label }) => ({ value, label }))}
          value={query.strategy}
          onValueChange={(v) => update({ strategy: v as Strategy })}
        />
        <p className="da-lab__hint">{strategyHint}</p>
        <div className="da-lab__checks">
          <Checkbox
            label="빈 버킷을 0으로 채우기"
            hint="꺼 두면 주문이 없던 날이 차트에서 빠져요."
            checked={query.fillGaps}
            onCheckedChange={(checked) => update({ fillGaps: checked === true })}
          />
          <Checkbox
            label="늦게 도착한 주문 2건 넣기"
            hint="롤업을 만든 뒤에 들어온 예시 주문이에요."
            checked={query.injectLate}
            onCheckedChange={(checked) => update({ injectLate: checked === true })}
          />
        </div>
      </div>

      <section className="da-lab__result" aria-label="차트 결과">
        <dl className="da-lab__metrics">
          <div>
            <dt>차트 점</dt>
            <dd data-testid="point-count">{result.points.length}개</dd>
          </div>
          <div>
            <dt>읽은 행</dt>
            <dd data-testid="read-rows">{result.readRows}행</dd>
          </div>
          <div>
            <dt>원본과 다른 점</dt>
            <dd data-testid="differ">{result.differ}개</dd>
          </div>
          <div>
            <dt>차이 합</dt>
            <dd data-testid="abs-diff">{KRW(result.absDiff)}</dd>
          </div>
        </dl>

        <div className="da-lab__chart" role="img" aria-label="차트 막대">
          {result.points.length === 0 ? (
            <p className="da-lab__hint">표시할 점이 없어요.</p>
          ) : (
            result.points.map((p) => (
              <div
                key={p.t}
                className="da-lab__bar"
                data-filled={p.filled ? 'true' : undefined}
                style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
                title={`${new Date(p.t).toISOString()} · ${KRW(p.value)}`}
              />
            ))
          )}
        </div>

        {result.notes.length > 0 && (
          <ul className="da-lab__notes">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="da-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
      </section>
    </div>
  );
}
