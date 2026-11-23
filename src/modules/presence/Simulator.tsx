import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  formatRanges,
  type KeyMode,
  type Method,
  type Params,
  type Scenario,
  SCENARIO_HINT,
  SCENARIO_LABEL,
  simulate,
} from './model';
import './Simulator.css';

const SCENARIOS: readonly Scenario[] = ['clean', 'crash', 'blip', 'second'];

const METHOD_OPTIONS: readonly { value: Method; label: string }[] = [
  { value: 'ttl', label: '하트비트 + TTL' },
  { value: 'event', label: '종료 이벤트만' },
];

const HB_OPTIONS = [5, 15, 30].map((s) => ({ value: String(s), label: `${s}초` }));
const TTL_OPTIONS = [15, 30, 45, 60, 90].map((s) => ({ value: String(s), label: `${s}초` }));
const GRACE_OPTIONS = [0, 5, 15, 30].map((s) => ({ value: String(s), label: s === 0 ? '없음' : `${s}초` }));
const WRITE_OPTIONS = [
  { value: '0', label: '기록 시점마다' },
  { value: '30', label: '30초마다' },
  { value: '60', label: '60초마다' },
];
const KEY_OPTIONS: readonly { value: KeyMode; label: string }[] = [
  { value: 'per-connection', label: '기기마다 키' },
  { value: 'per-user', label: '사용자당 키 하나' },
];

const DEFAULT_PARAMS: Params = {
  method: 'ttl',
  hbSec: 15,
  ttlSec: 45,
  graceSec: 5,
  writeSec: 30,
  keyMode: 'per-connection',
  scenario: 'clean',
};

const ROWS = [
  { key: 'real', label: '실제 연결' },
  { key: 'server', label: '서버 판단' },
  { key: 'display', label: '화면 표시' },
] as const;

export default function Simulator() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const result = simulate(params);
  const set = (patch: Partial<Params>) => setParams((prev) => ({ ...prev, ...patch }));
  const isEvent = params.method === 'event';
  const hbNotUsed = isEvent;
  const ttlTooShort = !isEvent && params.ttlSec <= params.hbSec;

  return (
    <div className="pr-lab">
      <RadioGroup
        label="사건 고르기"
        options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))}
        value={params.scenario}
        onValueChange={(v) => set({ scenario: v as Scenario })}
      />
      <p className="pr-lab__hint">{SCENARIO_HINT[params.scenario]}</p>

      <div className="pr-lab__controls">
        <RadioGroup
          label="판단 방식"
          options={METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={params.method}
          onValueChange={(v) => set({ method: v as Method })}
        />
        <RadioGroup
          label="하트비트 간격"
          options={HB_OPTIONS}
          value={String(params.hbSec)}
          onValueChange={(v) => set({ hbSec: Number(v) })}
        />
        <RadioGroup
          label="TTL"
          options={TTL_OPTIONS}
          value={String(params.ttlSec)}
          onValueChange={(v) => set({ ttlSec: Number(v) })}
        />
        <RadioGroup
          label="표시 유예"
          options={GRACE_OPTIONS}
          value={String(params.graceSec)}
          onValueChange={(v) => set({ graceSec: Number(v) })}
        />
        <RadioGroup
          label="마지막 접속 기록 주기"
          options={WRITE_OPTIONS}
          value={String(params.writeSec)}
          onValueChange={(v) => set({ writeSec: Number(v) })}
        />
        <RadioGroup
          label="키 단위"
          options={KEY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={params.keyMode}
          onValueChange={(v) => set({ keyMode: v as KeyMode })}
        />
      </div>

      {hbNotUsed && <p className="pr-lab__hint">종료 이벤트만 믿는 방식은 하트비트와 TTL을 쓰지 않아요.</p>}
      {ttlTooShort && (
        <p className="pr-lab__warn">TTL이 하트비트 간격 이하예요. 정상 연결도 하트비트 사이에 만료돼 깜빡여요.</p>
      )}

      <section className="pr-lab__timeline" aria-label="타임라인">
        {ROWS.map((row) => (
          <div className="pr-lab__row" key={row.key}>
            <span className="pr-lab__row-label">{row.label}</span>
            <div className="pr-lab__strip" role="img" aria-label={`${row.label} 0~119초`}>
              {result.ticks.map((k) => {
                const on = k[row.key];
                const mismatch = row.key === 'display' && k.display !== k.real;
                return (
                  <span
                    key={k.t}
                    className="pr-lab__cell"
                    data-on={on ? 'true' : 'false'}
                    data-mismatch={mismatch ? 'true' : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="pr-lab__axis" aria-hidden="true">
          <span>0초</span>
          <span>60초</span>
          <span>119초</span>
        </div>
        <p className="pr-lab__legend">
          초록은 온라인, 회색은 오프라인이에요. 화면 표시 줄의 빨간 칸은 실제와 다르게 보이는 초예요.
        </p>
      </section>

      <section className="pr-lab__result" aria-label="잘못 표시된 시간">
        <dl className="pr-lab__metrics">
          <div>
            <dt>끊겼는데 온라인으로 보임</dt>
            <dd>{result.staleOnline}초</dd>
          </div>
          <div>
            <dt>연결됐는데 오프라인으로 보임</dt>
            <dd>{result.falseOffline}초</dd>
          </div>
          <div>
            <dt>화면 상태 바뀐 횟수</dt>
            <dd>{result.flips}번</dd>
          </div>
          <div>
            <dt>마지막 접속 기록 쓰기</dt>
            <dd>{result.writes}번</dd>
          </div>
          <div>
            <dt>저장된 마지막 접속 오차</dt>
            <dd>{result.lastSeenError}초</dd>
          </div>
        </dl>
        {result.staleRanges.length > 0 && (
          <p className="pr-lab__hint">끊겼는데 온라인으로 보인 구간: {formatRanges(result.staleRanges)}</p>
        )}
        {result.falseRanges.length > 0 && (
          <p className="pr-lab__hint">연결됐는데 오프라인으로 보인 구간: {formatRanges(result.falseRanges)}</p>
        )}
      </section>

      <p className="pr-lab__hint">
        수치는 감을 잡기 위한 예시예요. 실제 값은 서비스의 기기 · 네트워크 환경에 맞춰 정해요.
      </p>
    </div>
  );
}
