import { Alert, Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { describeDay, MAX_DAY, PLATFORMS, POLICIES, pct, policyById, snapshot, type PolicyId } from './model';
import './Simulator.css';

export default function Simulator() {
  const [policyId, setPolicyId] = useState<PolicyId>('sunset');
  const [day, setDay] = useState(95);

  const policy = policyById(policyId);
  const snap = useMemo(() => snapshot(day, policy), [day, policy]);
  const { sunsetDay } = policy;

  return (
    <div className="av-lab">
      <RadioGroup
        label="폐기 정책"
        options={POLICIES.map((p) => ({ value: p.id, label: p.label }))}
        value={policyId}
        onValueChange={(value) => setPolicyId(value as PolicyId)}
      />
      <p className="av-lab__summary">{policy.summary}</p>

      <label className="av-field">
        <span>
          날짜 <strong>{day}일째</strong>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_DAY}
          step={1}
          value={day}
          aria-valuetext={`${day}일째`}
          onChange={(e) => setDay(Number(e.target.value))}
        />
      </label>

      <div className="av-lab__actions">
        <Button variant="ghost" size="sm" onClick={() => setDay(0)}>
          처음으로
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDay(policy.deprecateDay)}>
          공지일로
        </Button>
        {sunsetDay !== null && (
          <Button variant="ghost" size="sm" onClick={() => setDay(sunsetDay)}>
            차단 날짜로
          </Button>
        )}
      </div>

      <div className="av-lab__stats">
        <Stat label="정상 응답" value={pct(snap.total.ok)} />
        <Stat label="경고 헤더" value={pct(snap.total.warned)} />
        <Stat label="업데이트 화면" value={pct(snap.total.gated)} />
        <Stat label="차단 (410)" value={pct(snap.total.blocked)} />
      </div>

      {snap.total.blocked > 0 && (
        <Alert
          tone="warning"
          title={`전체 사용자 ${pct(snap.total.blocked)}가 차단 응답을 받아요. 앱은 업데이트 안내로 받아야 빈 화면이 되지 않아요.`}
        />
      )}

      <p className="av-lab__narration" aria-live="polite">
        {describeDay(policy, day, snap.total)}
      </p>

      <section className="av-lab__table-wrap" aria-labelledby="av-table-title">
        <h3 id="av-table-title">플랫폼별 응답</h3>
        <table className="av-table">
          <thead>
            <tr>
              <th scope="col">플랫폼 (예시 비율)</th>
              <th scope="col">정상</th>
              <th scope="col">경고</th>
              <th scope="col">업데이트 화면</th>
              <th scope="col">차단</th>
            </tr>
          </thead>
          <tbody>
            {snap.rows.map((row) => (
              <tr key={row.platform.id}>
                <th scope="row">
                  {row.platform.label} ({pct(row.platform.share)})
                </th>
                <td>{pct(row.outcomes.ok)}</td>
                <td>{pct(row.outcomes.warned)}</td>
                <td>{pct(row.outcomes.gated)}</td>
                <td>{pct(row.outcomes.blocked)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="av-lab__note">
          옛 버전을 쓰는 비율은 전체 {pct(snap.oldShare)}예요. 업데이트 속도는 {PLATFORMS[1].label}{' '}
          {PLATFORMS[1].adoptDays}일, {PLATFORMS[2].label} {PLATFORMS[2].adoptDays}일 기준이에요. 수치는 감을 잡기 위한
          예시예요.
        </p>
      </section>

      <section className="av-lab__events" aria-labelledby="av-events-title">
        <h3 id="av-events-title">정책 일정</h3>
        <ol>
          {snap.events.map((e) => (
            <li key={`${e.day}-${e.text}`} className={day >= e.day ? 'av-events__done' : undefined}>
              {e.day}일째 · {e.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
