import { Button, RadioGroup, Stat, Switch, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { runLab, type LabConfig, type Strategy } from './model';
import './Simulator.css';

const INITIAL: LabConfig = { strategy: 'n-plus-one', listSize: 10, latencyMs: 5, batchSize: 5, indexed: true };

const STRATEGY_OPTIONS: { value: Strategy; label: string; hint: string }[] = [
  { value: 'n-plus-one', label: 'N+1 · 글마다 따로 조회', hint: 'ORM 의 lazy loading 이 만드는 모양이에요' },
  { value: 'join', label: 'JOIN · 한 번에 합치기', hint: '결과 행이 글 × 댓글 수만큼 늘어나요' },
  {
    value: 'in-batch',
    label: 'IN 묶음 · 여러 글을 묶어 조회',
    hint: 'Django prefetch, SQLAlchemy selectinload 와 같은 모양이에요',
  },
];

const STRATEGY_SHORT: Record<Strategy, string> = {
  'n-plus-one': 'N+1 방식',
  join: 'JOIN 방식',
  'in-batch': 'IN 묶음 방식',
};

const formatMs = (ms: number) => `${ms.toFixed(1)} ms`;

interface RangeFieldProps {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function RangeField({ id, label, unit, min, max, value, disabled, onChange }: RangeFieldProps) {
  return (
    <div className="np-range">
      <div className="np-range__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function Simulator() {
  const [config, setConfig] = useState<LabConfig>(INITIAL);
  const result = useMemo(() => runLab(config), [config]);
  const update = (patch: Partial<LabConfig>) => setConfig((prev) => ({ ...prev, ...patch }));
  const maxMs = Math.max(...result.log.map((item) => item.ms), 1);
  const size = Math.max(1, Math.floor(config.listSize));
  const summary = `글 ${size}개를 ${STRATEGY_SHORT[config.strategy]}으로 가져오면 쿼리 ${result.queries}번, 예상 ${formatMs(result.estimatedMs)} 정도예요.`;

  return (
    <div className="np-lab">
      <div className="np-controls">
        <RadioGroup
          label="조회 방식"
          options={STRATEGY_OPTIONS}
          value={config.strategy}
          onValueChange={(strategy) => update({ strategy })}
        />
        <RangeField
          id="np-list-size"
          label="목록 크기"
          unit="개"
          min={1}
          max={100}
          value={config.listSize}
          onChange={(listSize) => update({ listSize })}
        />
        <RangeField
          id="np-latency"
          label="DB 왕복 지연 (예시)"
          unit="ms"
          min={1}
          max={50}
          value={config.latencyMs}
          onChange={(latencyMs) => update({ latencyMs })}
        />
        <RangeField
          id="np-batch-size"
          label="IN 묶음 크기"
          unit="개"
          min={1}
          max={50}
          disabled={config.strategy !== 'in-batch'}
          value={config.batchSize}
          onChange={(batchSize) => update({ batchSize })}
        />
        <Switch
          checked={config.indexed}
          onCheckedChange={(indexed) => update({ indexed })}
          label="comments.post_id 인덱스 사용"
          hint="끄면 쿼리마다 댓글 테이블 전체를 읽어요"
        />
        <div className="np-controls__foot">
          <Tag variant={config.indexed ? 'accent' : 'outline'}>{config.indexed ? '인덱스 있음' : '인덱스 없음'}</Tag>
          <Button variant="ghost" size="sm" onClick={() => setConfig(INITIAL)}>
            기본값으로
          </Button>
        </div>
      </div>

      <div className="np-result">
        <p className="np-summary" aria-live="polite">
          {summary}
        </p>
        <div className="np-stats">
          <Stat label="쿼리 수" value={result.queries} unit="번" />
          <Stat label="읽은 행" value={result.rowsScanned.toLocaleString('ko-KR')} unit="행" />
          <Stat label="예상 시간" value={Math.round(result.estimatedMs)} unit="ms" tone="accent" />
        </div>
        <p className="np-note">
          예상 시간은 쿼리 수 × 왕복 지연 + 읽은 행 수 × 행당 비용으로 계산한 단순화 모델이에요. 모든 숫자는 예시예요.
        </p>
        <ol className="np-log" aria-label="실행되는 쿼리 순서">
          {result.log.map((item, i) => (
            <li key={i} className="np-log__item">
              <div className="np-log__head">
                <span>{item.label}</span>
                <span className="np-log__ms">{formatMs(item.ms)}</span>
              </div>
              <code className="np-log__sql">{item.sql}</code>
              <div className="np-log__track" aria-hidden="true">
                <span className="np-log__bar" style={{ width: `${(item.ms / maxMs) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
