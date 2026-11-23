import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  decide,
  DEFAULT_SCENARIO,
  type Action,
  type Owner,
  type Org,
  type Scenario,
  type StatusCode,
  type Strategy,
  PRESETS,
} from './model';
import './Simulator.css';

type Who = 'anonymous' | 'member' | 'admin';

const WHO_OPTIONS: readonly { value: Who; label: string }[] = [
  { value: 'anonymous', label: '로그인하지 않음' },
  { value: 'member', label: '회원' },
  { value: 'admin', label: '조직 관리자' },
];

const ORG_OPTIONS: readonly { value: Org; label: string }[] = [
  { value: 'A', label: 'A 조직' },
  { value: 'B', label: 'B 조직' },
];

const OWNER_OPTIONS: readonly { value: Owner; label: string }[] = [
  { value: 'self', label: '본인 주문' },
  { value: 'colleague', label: '같은 조직 동료 주문' },
  { value: 'outsider', label: '다른 조직 고객 주문' },
];

const ACTION_OPTIONS: readonly { value: Action; label: string }[] = [
  { value: 'read', label: '조회' },
  { value: 'update', label: '수정' },
  { value: 'export', label: '조직 주문 내보내기' },
];

const STRATEGY_OPTIONS: readonly { value: Strategy; label: string; hint: string }[] = [
  { value: 'ui-only', label: '화면 숨김만', hint: '관리자 버튼을 숨기고, 서버는 요청을 그대로 처리해요.' },
  { value: 'role-only', label: '역할 검사만', hint: '회원인지 관리자인지만 보고, 대상의 주인은 보지 않아요.' },
  {
    value: 'role-and-owner',
    label: '역할 + 소유자 검사',
    hint: '역할로 동작을 가리고, 주문마다 주인과 조직을 확인해요.',
  },
];

const STATUS_TEXT: Record<StatusCode, string> = {
  200: '200 OK',
  401: '401 Unauthorized',
  403: '403 Forbidden',
  404: '404 Not Found',
};

const whoOf = (s: Scenario): Who => (!s.authenticated ? 'anonymous' : s.role);

export default function Simulator() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [presetId, setPresetId] = useState('');

  const update = (patch: Partial<Scenario>) => {
    setPresetId('');
    setScenario((prev) => ({ ...prev, ...patch }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setScenario(preset.scenario);
  };

  const chooseWho = (who: Who) => {
    if (who === 'anonymous') update({ authenticated: false });
    else update({ authenticated: true, role: who });
  };

  const outcome = decide(scenario);

  return (
    <div className="au-lab">
      <RadioGroup
        label="예시로 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="au-lab__grid">
        <RadioGroup
          label="요청자는 누구인가요?"
          options={WHO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={whoOf(scenario)}
          onValueChange={(v) => chooseWho(v as Who)}
        />
        <RadioGroup
          label="요청자의 소속 조직은요?"
          options={ORG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.org}
          onValueChange={(v) => update({ org: v as Org })}
        />
        <RadioGroup
          label="요청한 주문의 주인은요?"
          options={OWNER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.owner}
          onValueChange={(v) => update({ owner: v as Owner })}
        />
        <RadioGroup
          label="요청 동작은 무엇인가요?"
          options={ACTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.action}
          onValueChange={(v) => update({ action: v as Action })}
        />
      </div>

      <div className="au-lab__strategy">
        <RadioGroup
          label="서버는 무엇을 검사하나요?"
          options={STRATEGY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.strategy}
          onValueChange={(v) => update({ strategy: v as Strategy })}
        />
        <p className="au-lab__hint">{STRATEGY_OPTIONS.find((o) => o.value === scenario.strategy)?.hint}</p>
        <Checkbox
          label="다른 사람 주문이면 404로 숨기기"
          hint="주문이 있는지조차 알려 주지 않아요. 역할 실패는 403으로 남아요."
          checked={scenario.hide404}
          onCheckedChange={(checked) => update({ hide404: checked === true })}
        />
      </div>

      <section className="au-lab__result" aria-label="응답">
        <p className="au-lab__status" data-status={outcome.status}>
          {STATUS_TEXT[outcome.status]}
        </p>
        <p className="au-lab__exposed" data-exposed={outcome.exposed ? 'yes' : 'no'}>
          {outcome.exposed ? '주문 내용이 응답에 담겨요.' : '응답에 주문 내용이 없어요.'}
        </p>
        <p className="au-lab__hint">{outcome.reason}</p>
      </section>

      <p className="au-lab__hint">
        수치는 없어요. 응답 코드와 노출 여부만 설명을 위해 보여 줘요. 실제 정책은 서비스마다 달라요.
      </p>
    </div>
  );
}
