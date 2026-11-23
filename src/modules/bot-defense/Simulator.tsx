import { Button, Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ATTACK_LABEL,
  ATTACKS,
  type Attack,
  DEFENSE_LABEL,
  DEFENSES,
  type Defense,
  GATE_LABEL,
  GATES,
  HORIZON,
  simulate,
} from './model';
import './Simulator.css';

const ATTACK_HINT: Record<Attack, string> = {
  brute: '한 계정에 사전의 비밀번호를 차례로 넣어요. 정답은 사전의 3,000개 중 어딘가에 있어요.',
  stuffing: '다른 사이트에서 유출된 아이디·비밀번호 쌍 250개를 계정마다 한 번씩 넣어요. 맞는 쌍은 3%예요.',
  spread: '같은 쌍을 IP 1000개로 나눠 보내요. 한 IP 에서 오는 요청은 한두 개뿐이에요.',
};

const DEFENSE_HINT: Record<Defense, string> = {
  ip: 'IP 하나가 10틱에 20번을 넘으면 그 IP 를 기다리게 해요.',
  account: '한 계정이 10틱 안에 3번 틀리면 그 계정을 10틱 동안 기다리게 해요.',
  global: '최근 10틱의 실패율이 30%를 넘으면 모든 요청에 캡차를 내요. 봇은 90%, 사람은 95%를 통과한다고 가정해요.',
  lockout: '한 계정이 30틱 안에 5번 틀리면 30틱 동안 잠가요. 주인도 같이 막혀요.',
  mfa: '비밀번호가 맞아도 두 번째 요소를 요구해요. 공격자에게는 두 번째 요소가 없다고 가정해요.',
};

export default function Simulator() {
  const [attack, setAttack] = useState<Attack>('spread');
  const [defenses, setDefenses] = useState<Defense[]>(['ip']);
  const [attackRate, setAttackRate] = useState(20);
  const [seed, setSeed] = useState(7);

  const toggle = (d: Defense, on: boolean) =>
    setDefenses((prev) => (on ? [...prev.filter((x) => x !== d), d] : prev.filter((x) => x !== d)));

  const r = simulate({ attack, defenses, attackRate, seed });
  const hasDefense = defenses.length > 0;

  return (
    <div className="bd-lab">
      <RadioGroup
        label="공격 방식"
        options={ATTACKS.map((a) => ({ value: a, label: ATTACK_LABEL[a] }))}
        value={attack}
        onValueChange={setAttack}
      />
      <p className="bd-lab__hint">{ATTACK_HINT[attack]}</p>

      <fieldset className="bd-lab__defenses">
        <legend>방어 조합</legend>
        {DEFENSES.map((d) => (
          <Checkbox
            key={d}
            label={DEFENSE_LABEL[d]}
            hint={DEFENSE_HINT[d]}
            checked={defenses.includes(d)}
            onCheckedChange={(checked) => toggle(d, checked === true)}
          />
        ))}
      </fieldset>

      <div className="bd-lab__controls">
        <label className="bd-field">
          <span>공격 요청 {attackRate}건 / 틱</span>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={attackRate}
            onChange={(e) => setAttackRate(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="bd-lab__seed">
        <span>
          시드 {seed} · {HORIZON}틱
        </span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="bd-lab__results" aria-label="결과">
        <Stat label="공격 성공 계정 수" value={r.compromised} unit="개" tone={r.compromised > 0 ? 'accent' : 'ink'} />
        <Stat label="막힌 정상 로그인" value={r.legitBlocked} unit="건" />
        <Stat label="잠긴 계정 수" value={r.lockedAccounts} unit="개" />
      </section>

      {r.compromised > 0 ? (
        <p className="bd-lab__alarm" role="status">
          공격이 계정 {r.compromised}개에 로그인했어요. 두 번째 요소가 없으면 막을 수 없는 계정이에요.
        </p>
      ) : (
        <p className="bd-lab__ok" role="status">
          이 시드에서는 공격이 계정에 로그인하지 못했어요.{' '}
          {hasDefense ? '방어가 막은 공격 요청은 아래 표에 있어요.' : '방어를 켜지 않은 상태예요.'}
        </p>
      )}

      <table className="bd-table">
        <caption>방어 단계별로 막힌 요청 수</caption>
        <thead>
          <tr>
            <th scope="col">방어 단계</th>
            <th scope="col">공격 요청</th>
            <th scope="col">정상 로그인</th>
          </tr>
        </thead>
        <tbody>
          {GATES.map((g) => (
            <tr key={g}>
              <th scope="row">{GATE_LABEL[g]}</th>
              <td>{r.attackBlockedBy[g]}</td>
              <td>{r.legitBlockedBy[g]}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">비밀번호 검사까지 간 공격 시도</th>
            <td>{r.attempts}</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>

      <p className="bd-lab__note">수치는 감을 잡기 위한 예시예요. 실제 서비스의 임계값이 아니에요.</p>
    </div>
  );
}
