import { Button, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { runLab, type CallMode, type LabConfig } from './model';
import './Simulator.css';

const INITIAL: LabConfig = { mode: 'rest-seq', rttMs: 120, serviceMs: 20 };

const MODE_OPTIONS: { value: CallMode; label: string; hint: string }[] = [
  { value: 'rest-seq', label: 'REST · 순서대로', hint: '앞 응답을 받은 뒤에 다음 리소스를 불러요' },
  { value: 'rest-par', label: 'REST · 가능한 것 병렬', hint: '의존이 없는 호출은 같이 보내요' },
  { value: 'bff', label: 'BFF · 한 번', hint: '서버가 화면용 응답을 만들어 한 번에 보내요' },
  { value: 'graphql', label: 'GraphQL · 한 번', hint: '필요한 필드만 골라 한 번에 받아요' },
];

const MODE_SHORT: Record<CallMode, string> = {
  'rest-seq': 'REST 순서대로',
  'rest-par': 'REST 병렬',
  bff: 'BFF',
  graphql: 'GraphQL',
};

const formatBytes = (bytes: number) => `${bytes.toLocaleString('ko-KR')} B`;

interface RangeFieldProps {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

function RangeField({ id, label, unit, min, max, value, onChange }: RangeFieldProps) {
  return (
    <div className="ac-range">
      <div className="ac-range__head">
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
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function Simulator() {
  const [config, setConfig] = useState<LabConfig>(INITIAL);
  const result = useMemo(() => runLab(config), [config]);
  const update = (patch: Partial<LabConfig>) => setConfig((prev) => ({ ...prev, ...patch }));
  const maxMs = Math.max(...result.log.map((item) => item.endMs), 1);
  const summary = `${MODE_SHORT[config.mode]} 방식이면 요청 ${result.requests}번, 화면 완성까지 예상 ${result.totalMs} ms 예요.`;

  return (
    <div className="ac-lab">
      <div className="ac-controls">
        <RadioGroup
          label="호출 방식"
          options={MODE_OPTIONS}
          value={config.mode}
          onValueChange={(mode) => update({ mode })}
        />
        <RangeField
          id="ac-rtt"
          label="클라이언트 ↔ 서버 왕복 (예시)"
          unit="ms"
          min={1}
          max={400}
          value={config.rttMs}
          onChange={(rttMs) => update({ rttMs })}
        />
        <RangeField
          id="ac-service"
          label="서버 내부 서비스 처리 기준 (예시)"
          unit="ms"
          min={5}
          max={100}
          value={config.serviceMs}
          onChange={(serviceMs) => update({ serviceMs })}
        />
        <p className="ac-graph">의존 그래프 · 상품 → 판매자 → 배송비, 상품 → 리뷰, 상품 → 추천</p>
        <div className="ac-controls__foot">
          <Tag variant={config.mode === 'bff' || config.mode === 'graphql' ? 'accent' : 'outline'}>
            {config.mode === 'bff' || config.mode === 'graphql' ? '서버가 호출을 묶어요' : '클라이언트가 호출해요'}
          </Tag>
          <Button variant="ghost" size="sm" onClick={() => setConfig(INITIAL)}>
            기본값으로
          </Button>
        </div>
      </div>

      <div className="ac-result">
        <p className="ac-summary" aria-live="polite">
          {summary}
        </p>
        <div className="ac-stats">
          <Stat label="화면 완성 시간" value={result.totalMs} unit="ms" tone="accent" />
          <Stat label="클라이언트 요청" value={result.requests} unit="번" />
          <Stat label="서버 내부 호출" value={result.serverCalls} unit="번" />
          <Stat label="받은 바이트" value={formatBytes(result.bytes)} />
          <Stat label="안 쓰는 바이트" value={formatBytes(result.overfetchBytes)} />
        </div>
        <p className="ac-note">
          완성 시간은 왕복 시간과 처리 시간, 전송 시간(바이트 ÷ 200 B/ms)을 더한 단순화 모델이에요. 모든 숫자는
          예시예요. BFF 와 GraphQL 은 이 모델에서 같은 숫자를 내요. 차이는 응답 모양을 누가 정하는지에 있어요.
        </p>
        <ol className="ac-log" aria-label="클라이언트가 보내는 요청">
          {result.log.map((item) => (
            <li key={item.label} className="ac-log__item">
              <div className="ac-log__head">
                <span>{item.label}</span>
                <span className="ac-log__ms">
                  {item.startMs}–{item.endMs} ms
                </span>
              </div>
              <div className="ac-log__track" aria-hidden="true">
                <span
                  className="ac-log__bar"
                  style={{
                    left: `${(item.startMs / maxMs) * 100}%`,
                    width: `${((item.endMs - item.startMs) / maxMs) * 100}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
