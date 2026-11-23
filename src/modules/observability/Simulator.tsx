import { Checkbox, Stat } from '@gook-lab/ui';
import { type CSSProperties, useMemo, useState } from 'react';
import {
  buildTrace,
  DEFAULT_CONFIG,
  type ObsConfig,
  REQUEST_COUNT,
  runRequests,
  serverTimingHeader,
  summarize,
} from './model';
import './Simulator.css';

const CAUSES: readonly { key: keyof ObsConfig; label: string; hint: string }[] = [
  {
    key: 'nPlusOne',
    label: 'N+1 쿼리가 있나요?',
    hint: '상품 12개를 하나씩 조회해요. 워터폴에 DB 막대가 줄줄이 생겨요.',
  },
  {
    key: 'slowPayment',
    label: '외부 결제 API 가 느린가요?',
    hint: '평소 120ms 가 920ms 가 돼요. 예시 값이에요.',
  },
  {
    key: 'bigResponse',
    label: '응답이 큰가요?',
    hint: '직렬화와 전송이 180ms 더 걸려요. 예시 값이에요.',
  },
];

const formatMs = (ms: number) => `${ms.toFixed(1)} ms`;

export default function Simulator() {
  const [config, setConfig] = useState<ObsConfig>(DEFAULT_CONFIG);

  const trace = useMemo(() => buildTrace(config), [config]);
  const now = useMemo(() => summarize(runRequests(config)), [config]);
  const base = useMemo(() => summarize(runRequests(DEFAULT_CONFIG)), []);

  const setFlag = (key: keyof ObsConfig, on: boolean) => setConfig((prev) => ({ ...prev, [key]: on }));
  const maxSample = Math.max(...now.samples, 1);

  const longest = trace.spans.find((s) => s.id === trace.longestId);

  return (
    <div className="ob-lab">
      <div className="ob-lab__causes">
        {CAUSES.map((c) => (
          <Checkbox
            key={c.key}
            label={c.label}
            hint={c.hint}
            checked={config[c.key]}
            onCheckedChange={(checked) => setFlag(c.key, checked === true)}
          />
        ))}
      </div>

      <section className="ob-lab__panel" aria-label="요청 하나의 워터폴">
        <h3>요청 하나 — span 워터폴</h3>
        <div className="ob-lab__stats">
          <Stat label="총 시간" value={formatMs(trace.total)} tone="accent" />
          <Stat label="DB 쿼리" value={trace.dbQueries} unit="번" />
          <Stat label="외부 결제 호출" value={formatMs(trace.externalMs)} />
        </div>

        <ol className="ob-wf" aria-label="span 목록">
          {trace.spans.map((s) => (
            <li
              key={s.id}
              className="ob-wf__row"
              data-kind={s.kind}
              data-longest={s.id === trace.longestId ? 'true' : undefined}
              style={{ '--depth': s.depth } as CSSProperties}
            >
              <span className="ob-wf__name">{s.name}</span>
              <span className="ob-wf__track" aria-hidden="true">
                <span
                  className="ob-wf__bar"
                  style={{
                    left: `${(s.start / Math.max(trace.total, 1)) * 100}%`,
                    width: `${Math.max(0.6, (s.duration / Math.max(trace.total, 1)) * 100)}%`,
                  }}
                />
              </span>
              <span className="ob-wf__ms">{formatMs(s.duration)}</span>
            </li>
          ))}
        </ol>
        <p className="ob-lab__hint">
          가장 긴 말단 span 은 <strong>{longest?.name}</strong> 이에요. 강조된 줄이 시간이 가장 많이 쓰인 곳이에요.
        </p>
        <p className="ob-lab__hint">
          이 응답이 붙이는 Server-Timing 예시: <code>{`Server-Timing: ${serverTimingHeader(trace)}`}</code>
        </p>
      </section>

      <section className="ob-lab__panel" aria-label="요청 100개의 분포">
        <h3>요청 {REQUEST_COUNT}개 — 평균과 백분위</h3>
        <table className="ob-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">기본 설정</th>
              <th scope="col">지금 설정</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['평균', 'avg'],
                ['p50 (중앙값)', 'p50'],
                ['p95', 'p95'],
                ['p99', 'p99'],
                ['최대', 'max'],
              ] as const
            ).map(([label, key]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{formatMs(base[key])}</td>
                <td data-key={key}>{formatMs(now[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ob-hist" role="img" aria-label="요청 100개 시간 분포, 짧은 순서대로 정렬">
          {now.samples.map((v, i) => (
            <span
              key={i}
              className="ob-hist__bar"
              data-tail={v >= now.p95 ? 'true' : undefined}
              style={{ height: `${(v / maxSample) * 100}%` }}
            />
          ))}
        </div>
        <p className="ob-lab__hint">
          요청 100개는 같은 시드로 만들어서 설정이 같으면 숫자도 같아요. 오른쪽 끝 막대가 p95 를 넘는 느린 꼬리예요.
        </p>
      </section>
    </div>
  );
}
