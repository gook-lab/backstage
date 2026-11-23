import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DEFAULT_SCENARIO,
  evaluate,
  GUARD_LABEL,
  type Guard,
  IMPACT_LABEL,
  INCIDENT_LABEL,
  type Incident,
  ISOLATION_LABEL,
  type Isolation,
  type Scenario,
} from './model';
import './Simulator.css';

const ISOLATION_OPTIONS: { value: Isolation; label: string }[] = [
  { value: 'pool', label: ISOLATION_LABEL.pool },
  { value: 'schema', label: ISOLATION_LABEL.schema },
  { value: 'database', label: ISOLATION_LABEL.database },
];

const GUARD_OPTIONS: { value: Guard; label: string }[] = [
  { value: 'manual', label: GUARD_LABEL.manual },
  { value: 'query-layer', label: GUARD_LABEL['query-layer'] },
  { value: 'rls', label: GUARD_LABEL.rls },
];

const INCIDENT_OPTIONS: { value: Incident; label: string }[] = [
  { value: 'none', label: INCIDENT_LABEL.none },
  { value: 'missing-filter', label: INCIDENT_LABEL['missing-filter'] },
  { value: 'forged-tenant', label: INCIDENT_LABEL['forged-tenant'] },
  { value: 'cache-reuse', label: INCIDENT_LABEL['cache-reuse'] },
  { value: 'big-tenant', label: INCIDENT_LABEL['big-tenant'] },
];

export default function Simulator() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const outcome = evaluate(scenario);

  const update = (patch: Partial<Scenario>) => setScenario((prev) => ({ ...prev, ...patch }));

  return (
    <div className="mt-lab">
      <div className="mt-lab__groups">
        <RadioGroup
          label="격리 모델"
          options={ISOLATION_OPTIONS}
          value={scenario.isolation}
          onValueChange={(v) => update({ isolation: v })}
        />
        <RadioGroup
          label="쿼리에 회사 조건을 넣는 방법"
          options={GUARD_OPTIONS}
          value={scenario.guard}
          onValueChange={(v) => update({ guard: v })}
        />
        <RadioGroup
          label="사고 시나리오"
          options={INCIDENT_OPTIONS}
          value={scenario.incident}
          onValueChange={(v) => update({ incident: v })}
        />
      </div>

      <div className="mt-lab__switches">
        <Checkbox
          label="테넌트별 한도를 걸었나요?"
          hint="큰 회사에 요청이 몰리는 시나리오에서 결과가 달라져요."
          checked={scenario.tenantLimit}
          onCheckedChange={(checked) => update({ tenantLimit: checked === true })}
        />
        <Checkbox
          label="캐시 키에 회사 식별자를 넣었나요?"
          hint="캐시 응답 재사용 시나리오에서 결과가 달라져요."
          checked={scenario.cacheKeyHasTenant}
          onCheckedChange={(checked) => update({ cacheKeyHasTenant: checked === true })}
        />
      </div>

      <section className="mt-lab__result" aria-label="결과">
        <p className="mt-lab__verdict" data-leaked={outcome.leaked}>
          {outcome.leaked ? '다른 회사 데이터가 보여요' : '다른 회사 데이터는 보이지 않아요'}
        </p>
        <p className="mt-lab__impact">영향 범위 — {IMPACT_LABEL[outcome.impact]}</p>
        <p className="mt-lab__hint">{outcome.reason}</p>
        <p className="mt-lab__hint">판단 규칙을 보여 주는 순수 모델이에요. 실제 DB 동작을 흉내 낸 것은 아니에요.</p>
      </section>
    </div>
  );
}
