import { Alert, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { type OtpConfig, type Scenario, evaluate } from './model';
import './Simulator.css';

const DEFAULT_CONFIG: OtpConfig = {
  scenario: 'brute',
  digits: 6,
  attemptLimit: 10,
  resetOnResend: false,
  invalidateOnResend: true,
  ttlSec: 180,
  cooldownSec: 30,
  sendLimitPerNumber: 10,
  sendLimitPerIp: 100,
};

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: 'brute', label: '무차별 대입 (번호 하나에 계속 시도)' },
  { value: 'resend', label: '재전송 반복 (실패 횟수 초기화 노림)' },
  { value: 'bomb', label: '문자 폭탄 (여러 번호에 발송 요청)' },
];

const DIGIT_OPTIONS = [
  { value: '6', label: '6자리' },
  { value: '8', label: '8자리' },
];

const ATTEMPT_OPTIONS = [
  { value: '5', label: '5회' },
  { value: '10', label: '10회' },
  { value: '100', label: '100회' },
  { value: 'none', label: '시도 한도 없음' },
];

const RESEND_COUNTER_OPTIONS = [
  { value: 'keep', label: '실패 횟수 유지' },
  { value: 'reset', label: '실패 횟수 초기화' },
];

const OLD_CODE_OPTIONS = [
  { value: 'invalidate', label: '이전 번호 무효화' },
  { value: 'keep', label: '이전 번호 유지' },
];

const TTL_OPTIONS = [
  { value: '60', label: '1분' },
  { value: '180', label: '3분' },
  { value: '600', label: '10분' },
];

const COOLDOWN_OPTIONS = [
  { value: '0', label: '간격 없음' },
  { value: '30', label: '30초' },
  { value: '60', label: '60초' },
  { value: '120', label: '120초' },
];

const PER_NUMBER_OPTIONS = [
  { value: '5', label: '번호당 5회' },
  { value: '10', label: '번호당 10회' },
  { value: 'none', label: '번호당 한도 없음' },
];

const PER_IP_OPTIONS = [
  { value: '20', label: 'IP당 20회' },
  { value: '100', label: 'IP당 100회' },
  { value: 'none', label: 'IP당 한도 없음' },
];

const toLimit = (value: string): number | null => (value === 'none' ? null : Number(value));
const limitValue = (limit: number | null): string => (limit === null ? 'none' : String(limit));

/** 맞힐 확률을 읽기 쉬운 퍼센트로 바꿔요 */
export function formatPercent(probability: number): string {
  const pct = probability * 100;
  if (pct === 0) return '0%';
  if (pct < 0.0001) return '0.0001% 미만';
  return `${Number(pct.toPrecision(2))}%`;
}

const formatCount = (n: number): string => n.toLocaleString('ko-KR');

export default function Simulator() {
  const [cfg, setCfg] = useState<OtpConfig>(DEFAULT_CONFIG);
  const patch = (next: Partial<OtpConfig>) => setCfg((prev) => ({ ...prev, ...next }));

  const result = evaluate(cfg);
  const isBomb = cfg.scenario === 'bomb';
  const pct = formatPercent(result.successProbability);

  const summary = isBomb
    ? `문자 폭탄: 발송 ${formatCount(result.smsSent)}건. 추측은 하지 않아요.`
    : `${cfg.scenario === 'brute' ? '무차별 대입' : '재전송 반복'}: 발송 ${formatCount(result.smsSent)}건, 추측 ${formatCount(result.guesses)}번, 맞힐 확률 ${pct}.`;

  const alertTitle = isBomb
    ? result.smsSent >= 100
      ? `한 사용자에게 문자가 ${formatCount(result.smsSent)}건 나가요.`
      : `발송 ${formatCount(result.smsSent)}건으로 묶였어요.`
    : result.successProbability >= 0.01
      ? `맞힐 확률이 ${pct}예요. 시도 한도나 발송 한도를 낮춰 보세요.`
      : `이 설정에서는 맞힐 확률이 ${pct}예요.`;

  return (
    <section className="ov" aria-labelledby="ov-title">
      <h3 id="ov-title" className="ov-title">
        인증번호 공격 놀이터
      </h3>
      <p className="ov-hint">
        공격자가 초당 20번 시도하고 10분 동안 공격한다고 가정해요. 서버 설정을 바꿔 가며 추측 횟수와 발송 건수가 어떻게
        달라지는지 보세요.
      </p>

      <RadioGroup
        label="공격 시나리오"
        options={SCENARIO_OPTIONS}
        value={cfg.scenario}
        onValueChange={(v) => patch({ scenario: v as Scenario })}
      />

      <div className="ov-controls">
        <RadioGroup
          label="번호 자릿수"
          options={DIGIT_OPTIONS}
          value={String(cfg.digits)}
          onValueChange={(v) => patch({ digits: v === '8' ? 8 : 6 })}
        />
        <RadioGroup
          label="시도 한도"
          options={ATTEMPT_OPTIONS}
          value={limitValue(cfg.attemptLimit)}
          onValueChange={(v) => patch({ attemptLimit: toLimit(v) })}
        />
        <RadioGroup
          label="번호 만료 시간"
          options={TTL_OPTIONS}
          value={String(cfg.ttlSec)}
          onValueChange={(v) => patch({ ttlSec: Number(v) })}
        />
        <RadioGroup
          label="재전송 때 실패 횟수"
          options={RESEND_COUNTER_OPTIONS}
          value={cfg.resetOnResend ? 'reset' : 'keep'}
          onValueChange={(v) => patch({ resetOnResend: v === 'reset' })}
        />
        <RadioGroup
          label="재전송 때 이전 번호"
          options={OLD_CODE_OPTIONS}
          value={cfg.invalidateOnResend ? 'invalidate' : 'keep'}
          onValueChange={(v) => patch({ invalidateOnResend: v === 'invalidate' })}
        />
        <RadioGroup
          label="재전송 간격"
          options={COOLDOWN_OPTIONS}
          value={String(cfg.cooldownSec)}
          onValueChange={(v) => patch({ cooldownSec: Number(v) })}
        />
        <RadioGroup
          label="번호당 발송 한도"
          options={PER_NUMBER_OPTIONS}
          value={limitValue(cfg.sendLimitPerNumber)}
          onValueChange={(v) => patch({ sendLimitPerNumber: toLimit(v) })}
        />
        <RadioGroup
          label="IP당 발송 한도"
          options={PER_IP_OPTIONS}
          value={limitValue(cfg.sendLimitPerIp)}
          onValueChange={(v) => patch({ sendLimitPerIp: toLimit(v) })}
        />
      </div>

      <div className="ov-stats">
        <Stat label="발송 건수" value={formatCount(result.smsSent)} unit="건" />
        <Stat label="추측 가능" value={isBomb ? '0' : formatCount(result.guesses)} unit="번" />
        <Stat label="살아 있는 번호" value={String(result.activeCodes)} unit="개" />
        <Stat label="맞힐 확률" value={isBomb ? '해당 없음' : pct} />
      </div>

      <p className="ov-summary" aria-live="polite">
        {summary}
      </p>

      <Alert
        tone={
          isBomb ? (result.smsSent >= 100 ? 'warning' : 'info') : result.successProbability >= 0.01 ? 'warning' : 'info'
        }
        title={alertTitle}
      />

      <p className="ov-note">수치는 감을 잡기 위한 예시예요.</p>
    </section>
  );
}
