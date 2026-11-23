import { RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DEFAULT_CONFIG,
  type InviteConfig,
  type InviteKind,
  type InviteStatus,
  type Role,
  type Scenario,
  SCENARIOS,
  simulate,
} from './model';
import './Simulator.css';

const KIND_OPTIONS: { value: InviteKind; label: string }[] = [
  { value: 'email', label: '이메일 지정' },
  { value: 'link', label: '공유 링크' },
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'member', label: '멤버' },
  { value: 'admin', label: '관리자' },
];

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = (Object.keys(SCENARIOS) as Scenario[]).map((value) => ({
  value,
  label: SCENARIOS[value].label,
}));

const ON_OFF = (on: string) => on === 'on';
const toOnOff = (on: boolean) => (on ? 'on' : 'off');

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: '대기 중',
  accepted: '수락됨',
  revoked: '취소됨',
  expired: '만료됨',
};

const ROLE_LABEL: Record<Role, string> = { member: '멤버', admin: '관리자' };

export default function Simulator() {
  const [cfg, setCfg] = useState<InviteConfig>(DEFAULT_CONFIG);
  const patch = (next: Partial<InviteConfig>) => setCfg((prev) => ({ ...prev, ...next }));

  const result = simulate(cfg);
  const joined = result.members.filter((m) => m.origin === 'joined').length;
  const isEmail = cfg.kind === 'email';

  return (
    <section className="ti" aria-labelledby="ti-title">
      <h3 id="ti-title" className="ti-title">
        팀 초대 수락 놀이터
      </h3>
      <p className="ti-hint">
        초대 방식과 방어를 고르고, 수락 요청이 어떻게 처리되는지 보세요. 계정 이메일은 가상이에요.
      </p>

      <div className="ti-controls">
        <RadioGroup
          label="초대 방식"
          options={KIND_OPTIONS}
          value={cfg.kind}
          onValueChange={(v) => patch({ kind: v as InviteKind })}
        />
        <RadioGroup
          label="초대에 적을 권한"
          options={ROLE_OPTIONS}
          value={cfg.role}
          onValueChange={(v) => patch({ role: v as Role })}
        />
        <RadioGroup
          label="사건"
          options={SCENARIO_OPTIONS}
          value={cfg.scenario}
          onValueChange={(v) => patch({ scenario: v as Scenario })}
        />
      </div>

      <div className="ti-controls">
        <RadioGroup
          label="만료 확인"
          options={[
            { value: 'on', label: '확인' },
            { value: 'off', label: '확인 안 함' },
          ]}
          value={toOnOff(cfg.checkExpiry)}
          onValueChange={(v) => patch({ checkExpiry: ON_OFF(v) })}
        />
        <RadioGroup
          label="1회 사용"
          options={[
            { value: 'on', label: '한 번만' },
            { value: 'off', label: '여러 번' },
          ]}
          value={toOnOff(cfg.singleUse)}
          onValueChange={(v) => patch({ singleUse: ON_OFF(v) })}
        />
        <RadioGroup
          label="이메일 일치 확인 (이메일 지정만)"
          options={[
            { value: 'on', label: '확인' },
            { value: 'off', label: '확인 안 함' },
          ]}
          value={toOnOff(cfg.checkEmail)}
          onValueChange={(v) => patch({ checkEmail: ON_OFF(v) })}
        />
        <RadioGroup
          label="수락 때 권한 재검증"
          options={[
            { value: 'on', label: '재검증' },
            { value: 'off', label: '재검증 안 함' },
          ]}
          value={toOnOff(cfg.revalidateRole)}
          onValueChange={(v) => patch({ revalidateRole: ON_OFF(v) })}
        />
        <RadioGroup
          label="취소할 때 상태 변경"
          options={[
            { value: 'on', label: '상태 변경' },
            { value: 'off', label: '표시만' },
          ]}
          value={toOnOff(cfg.revokeUpdatesStatus)}
          onValueChange={(v) => patch({ revokeUpdatesStatus: ON_OFF(v) })}
        />
      </div>

      <div className="ti-stats">
        <Stat label="수락 성공" value={String(result.acceptedCount)} unit="건" />
        <Stat label="초대 상태" value={STATUS_LABEL[result.status]} />
        <Stat label="팀 멤버" value={String(result.members.length)} unit="명" />
        <Stat label="이번에 들어간 수" value={String(joined)} unit="명" />
      </div>

      <div className="ti-panel" aria-live="polite">
        <h4 className="ti-sub">수락 요청 결과</h4>
        <ol className="ti-list">
          {result.outcomes.map((o, i) => (
            <li key={`${o.actor}-${i}`} className={o.ok ? 'ti-ok' : 'ti-ng'}>
              <span className="ti-badge">{o.ok ? '성공' : '거절'}</span>
              <span className="ti-who">{o.email}</span>
              <span className="ti-msg">{o.message}</span>
            </li>
          ))}
        </ol>
        {isEmail ? null : <p className="ti-note">공유 링크는 연 계정을 확인하지 않아요.</p>}
        {result.notes.map((note) => (
          <p key={note} className="ti-note ti-warn">
            {note}
          </p>
        ))}
      </div>

      <div className="ti-panel">
        <h4 className="ti-sub">팀 멤버 목록 변화</h4>
        <table className="ti-table">
          <thead>
            <tr>
              <th scope="col">이메일</th>
              <th scope="col">권한</th>
              <th scope="col">이번 수락</th>
            </tr>
          </thead>
          <tbody>
            {result.members.map((m) => (
              <tr key={m.email} className={m.origin === 'joined' ? 'ti-new' : undefined}>
                <td>{m.email}</td>
                <td>{ROLE_LABEL[m.role]}</td>
                <td>{m.origin === 'joined' ? '새로 참여' : '기존 멤버'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ti-note">수치는 감을 잡기 위한 예시예요.</p>
    </section>
  );
}
