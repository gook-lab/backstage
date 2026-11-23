import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import { ATTACK_IDS, ATTACK_LABEL, FLOW_IDS, FLOWS, simulateLogin, type Attack, type Flow } from './model';
import './Simulator.css';

const FLOW_OPTIONS = FLOW_IDS.map((id) => ({ value: id, label: FLOWS[id].label }));
const ATTACK_OPTIONS = ATTACK_IDS.map((id) => ({ value: id, label: ATTACK_LABEL[id] }));

const VERDICT: Record<'login' | 'blocked' | 'compromised', string> = {
  login: '로그인이 끝났어요',
  blocked: '공격이 막혔어요',
  compromised: '공격이 통과했어요',
};

const STATUS_LABEL = { ok: '통과', blocked: '차단', leak: '노출' } as const;

export default function Simulator() {
  const [flow, setFlow] = useState<Flow>('pkce');
  const [attack, setAttack] = useState<Attack>('normal');

  const result = simulateLogin(flow, attack);

  return (
    <div className="sl-lab">
      <RadioGroup label="흐름을 고르세요" options={FLOW_OPTIONS} value={flow} onValueChange={(v) => setFlow(v)} />

      <RadioGroup
        label="시나리오를 고르세요"
        options={ATTACK_OPTIONS}
        value={attack}
        onValueChange={(v) => setAttack(v)}
      />

      <section className="sl-lab__result" aria-label="로그인 결과">
        <p className="sl-lab__verdict" data-outcome={result.outcome}>
          {VERDICT[result.outcome]}
        </p>
        {result.blockedBy ? <p className="sl-lab__reason">막은 검사: {result.blockedBy}</p> : null}

        <ol className="sl-lab__steps">
          {result.steps.map((step, idx) => (
            <li key={idx} className="sl-lab__step" data-status={step.status}>
              <span className="sl-lab__badge">{STATUS_LABEL[step.status]}</span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="sl-lab__note">
        단계는 프로토콜을 줄여 그린 모델이에요. 실제 공급자 화면과 응답 순서는 다를 수 있어요.
      </p>
    </div>
  );
}
