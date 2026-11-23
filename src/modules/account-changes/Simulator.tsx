import { Alert, Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { type AccountConfig, type AccountResult, type Scenario, TOTAL_SESSIONS, evaluate } from './model';
import './Simulator.css';

const DEFAULT_CONFIG: AccountConfig = {
  scenario: 'takeover',
  reauth: false,
  pending: false,
  notifyOld: false,
  revokeOthers: false,
  uniqueAtConfirm: false,
};

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: 'takeover', label: '세션 탈취 (공격자가 이메일 변경)' },
  { value: 'typo', label: '오타 난 새 이메일' },
  { value: 'otherDevice', label: '다른 기기 세션 (비밀번호 변경)' },
  { value: 'collision', label: '같은 새 이메일을 두 계정이 동시에 요청' },
];

const yesNo = (value: boolean): string => (value ? '예' : '아니요');

/** 시나리오와 설정에 따라 사실 문장을 만들어요 */
function describe(cfg: AccountConfig, r: AccountResult): { summary: string; title: string } {
  switch (cfg.scenario) {
    case 'takeover':
      if (!r.attackerAccess) {
        return {
          summary: '재인증에서 막혀요. 공격자는 변경 요청을 할 수 없어요.',
          title: '재인증이 공격자를 막았어요.',
        };
      }
      return {
        summary: [
          '공격자가 새 주소로 계정을 가져가요.',
          cfg.pending ? '확인 링크도 공격자 주소로 가서 대기만으로는 막히지 않아요.' : '',
          cfg.notifyOld
            ? '옛 주소 알림의 되돌리기 링크로 되찾을 수 있어요.'
            : '옛 주소 알림이 없어서 되돌릴 수 없어요.',
        ]
          .filter(Boolean)
          .join(' '),
        title: '계정을 가져갈 수 있어요.',
      };
    case 'typo':
      if (cfg.pending) {
        return {
          summary: '확인 메일이 오타 주소로 가서 아무도 누르지 않아요. 로그인 주소는 옛 주소 그대로예요.',
          title: '대기 상태라서 잠기지 않아요.',
        };
      }
      return {
        summary: cfg.notifyOld
          ? '다음 로그인부터 오타 주소를 써요. 옛 주소 알림의 되돌리기 링크로 되돌릴 수 있어요.'
          : '다음 로그인부터 오타 주소를 써요. 되돌릴 방법이 없어 계정을 잃어요.',
        title: r.lockedOut ? '오타 주소로 바뀌어 계정을 잃을 수 있어요.' : '오타를 되돌릴 수 있어요.',
      };
    case 'otherDevice':
      return {
        summary: cfg.revokeOthers
          ? '비밀번호를 바꾼 현재 기기만 남아요. 공격자 세션도 끊겨요.'
          : `공격자 세션이 그대로 살아 있어요. 비밀번호를 바꿔도 접근이 유지돼요. 세션은 ${TOTAL_SESSIONS}개예요.`,
        title: r.attackerAccess ? '공격자 세션이 살아 있어요.' : '공격자 세션이 끊겼어요.',
      };
    case 'collision':
      return {
        summary: r.exposure
          ? '요청 응답이 "사용 중"이라고 알려서 계정 존재가 드러나요.'
          : '요청 응답은 같아요. 확정 때 한 계정만 주소를 얻어요.',
        title: r.exposure ? '계정 존재가 드러나요.' : '계정 존재가 드러나지 않아요.',
      };
  }
}

export default function Simulator() {
  const [cfg, setCfg] = useState<AccountConfig>(DEFAULT_CONFIG);
  const patch = (next: Partial<AccountConfig>) => setCfg((prev) => ({ ...prev, ...next }));

  const result = evaluate(cfg);
  const text = describe(cfg, result);
  const alertTone = result.attackerAccess || result.lockedOut || result.exposure === true ? 'warning' : 'info';
  const isTakeover = cfg.scenario === 'takeover';
  const isCollision = cfg.scenario === 'collision';

  return (
    <section className="acc" aria-labelledby="acc-title">
      <h3 id="acc-title" className="acc-title">
        계정 변경 공격 놀이터
      </h3>
      <p className="acc-hint">
        변경 방식을 켜고 끄면서 사건별 결과를 보세요. 공격자는 세션 하나를 가지고 있다고 가정해요.
      </p>

      <RadioGroup
        label="사건"
        options={SCENARIO_OPTIONS}
        value={cfg.scenario}
        onValueChange={(v) => patch({ scenario: v as Scenario })}
      />

      <div className="acc-toggles">
        <Checkbox
          label="현재 비밀번호를 다시 받아요"
          hint="세션만 가진 사람은 변경 요청에서 막혀요."
          checked={cfg.reauth}
          disabled={!isTakeover}
          onCheckedChange={(checked) => patch({ reauth: checked === true })}
        />
        <Checkbox
          label="새 주소는 확인 링크를 누르기 전까지 대기해요"
          hint="확정 전까지 로그인 · 알림 주소는 옛 주소예요."
          checked={cfg.pending}
          onCheckedChange={(checked) => patch({ pending: checked === true })}
        />
        <Checkbox
          label="옛 주소로 변경 알림과 되돌리기 링크를 보내요"
          checked={cfg.notifyOld}
          onCheckedChange={(checked) => patch({ notifyOld: checked === true })}
        />
        <Checkbox
          label="변경 뒤 바꾼 세션을 뺀 나머지 세션을 끊어요"
          checked={cfg.revokeOthers}
          onCheckedChange={(checked) => patch({ revokeOthers: checked === true })}
        />
        <Checkbox
          label="요청 때 미리 검사하지 않고 확정 때만 검사해요"
          hint="유일 제약은 어느 쪽이든 DB에 둬요."
          checked={cfg.uniqueAtConfirm}
          disabled={!isCollision}
          onCheckedChange={(checked) => patch({ uniqueAtConfirm: checked === true })}
        />
      </div>

      <div className="acc-stats">
        <Stat label="공격자 접근" value={yesNo(result.attackerAccess)} />
        <Stat label="되돌리기" value={result.reversible === null ? '해당 없음' : result.reversible ? '가능' : '불가'} />
        <Stat
          label="남은 세션"
          value={result.sessionsLeft === null ? '해당 없음' : String(result.sessionsLeft)}
          unit={result.sessionsLeft === null ? undefined : '개'}
        />
        <Stat label="계정 존재 노출" value={result.exposure === null ? '해당 없음' : yesNo(result.exposure)} />
      </div>

      <p className="acc-summary" aria-live="polite">
        {text.summary}
      </p>

      <Alert tone={alertTone} title={text.title} />

      <p className="acc-note">수치는 감을 잡기 위한 예시예요. 세션은 3개(현재 기기 포함)와 공격자 1개로 가정했어요.</p>
    </section>
  );
}
