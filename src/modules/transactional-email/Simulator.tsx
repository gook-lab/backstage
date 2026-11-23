import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  BUSY_RANGE,
  type DkimResult,
  type DmarcPolicy,
  OUTCOME_LABEL,
  type Outcome,
  RECIPIENT_LABEL,
  RESEND_NOTICE,
  type Recipient,
  type RetryPolicy,
  type SpfResult,
  type Sender,
  resendRequest,
  simulateMail,
} from './model';
import './Simulator.css';

const RECIPIENTS: readonly Recipient[] = ['ok', 'busy', 'missing'];
const RETRY_LABEL: Record<RetryPolicy, string> = {
  none: '재시도 안 함',
  fixed: '고정 간격 (3분 간격, 예시)',
  backoff: '지수 백오프 (1 · 2 · 4 · 8분, 예시)',
};
const DMARC_LABEL: Record<DmarcPolicy, string> = {
  none: '없음 (none)',
  quarantine: '스팸함 (quarantine)',
  reject: '거부 (reject)',
};
const REPLY_LABEL = { ok: '250 수락', '4yz': '4yz 일시 거절', '5yz': '5yz 영구 실패' } as const;
const OUTCOME_TONE: Record<Outcome, 'ink' | 'accent'> = {
  delivered: 'ink',
  retried: 'ink',
  spam: 'accent',
  bounced: 'accent',
  lost: 'accent',
};
const COOLDOWN = 3;

export default function Simulator() {
  const [recipient, setRecipient] = useState<Recipient>('busy');
  const [busyMinutes, setBusyMinutes] = useState(6);
  const [spf, setSpf] = useState<SpfResult>('pass');
  const [dkim, setDkim] = useState<DkimResult>('pass');
  const [aligned, setAligned] = useState<'yes' | 'no'>('yes');
  const [dmarc, setDmarc] = useState<DmarcPolicy>('quarantine');
  const [retry, setRetry] = useState<RetryPolicy>('backoff');

  const [accountExists, setAccountExists] = useState<'yes' | 'no'>('yes');
  const [now, setNow] = useState(0);
  const [lastRequestedAt, setLastRequestedAt] = useState<number | null>(null);
  const [lastResend, setLastResend] = useState<{ message: string; mailSent: boolean } | null>(null);

  const sender: Sender = { spf, dkim, aligned: aligned === 'yes', dmarc };
  const result = simulateMail({ recipient, busyMinutes, sender, retry });

  const requestResend = () => {
    const r = resendRequest({
      accountExists: accountExists === 'yes',
      lastRequestedAt,
      now,
      cooldown: COOLDOWN,
    });
    setLastRequestedAt(now);
    setLastResend({ message: r.message, mailSent: r.mailSent });
  };

  return (
    <div className="tm-lab">
      <p className="tm-lab__hint">
        수신 상태와 발신 설정, 재시도 정책을 골라 메일 한 통이 어떻게 되는지 확인해요. 사용자 화면에는 결과와 무관하게
        같은 문구만 나가요.
      </p>

      <div className="tm-lab__controls">
        <RadioGroup
          label="수신 상태"
          options={RECIPIENTS.map((r) => ({ value: r, label: RECIPIENT_LABEL[r] }))}
          value={recipient}
          onValueChange={setRecipient}
        />
        <RadioGroup
          label="재시도 정책"
          options={(Object.keys(RETRY_LABEL) as RetryPolicy[]).map((r) => ({ value: r, label: RETRY_LABEL[r] }))}
          value={retry}
          onValueChange={setRetry}
        />
        <RadioGroup
          label="SPF"
          options={[
            { value: 'pass', label: 'SPF 통과' },
            { value: 'fail', label: 'SPF 실패' },
          ]}
          value={spf}
          onValueChange={setSpf}
        />
        <RadioGroup
          label="DKIM"
          options={[
            { value: 'pass', label: 'DKIM 통과' },
            { value: 'fail', label: 'DKIM 실패' },
          ]}
          value={dkim}
          onValueChange={setDkim}
        />
        <RadioGroup
          label="From 정렬"
          options={[
            { value: 'yes', label: 'From 정렬 맞음' },
            { value: 'no', label: 'From 정렬 안 맞음' },
          ]}
          value={aligned}
          onValueChange={setAligned}
        />
        <RadioGroup
          label="DMARC 정책"
          options={(Object.keys(DMARC_LABEL) as DmarcPolicy[]).map((d) => ({ value: d, label: DMARC_LABEL[d] }))}
          value={dmarc}
          onValueChange={setDmarc}
        />
      </div>

      <label className="tm-field">
        <span>일시 거절이 이어지는 시간: {busyMinutes}분 (예시)</span>
        <input
          type="range"
          min={BUSY_RANGE.min}
          max={BUSY_RANGE.max}
          value={busyMinutes}
          onChange={(e) => setBusyMinutes(Number(e.target.value))}
        />
      </label>

      <section className="tm-lab__results" aria-label="결과">
        <Stat label="메일 결과" value={OUTCOME_LABEL[result.outcome]} tone={OUTCOME_TONE[result.outcome]} />
        <Stat label="전달까지" value={result.deliveredAt === null ? '없음' : `${result.deliveredAt}분`} unit="예시" />
      </section>

      <ol className="tm-attempts" aria-label="시도 기록">
        {result.attempts.map((a, i) => (
          <li key={`${a.minute}-${i}`}>
            {a.minute}분 · {REPLY_LABEL[a.reply]}
          </li>
        ))}
      </ol>
      <p className="tm-lab__note" role="status">
        운영 기록: {result.log}
      </p>
      <p className="tm-lab__notice" aria-label="사용자 화면 문구">
        {RESEND_NOTICE}
      </p>

      <section className="tm-resend" aria-label="다시 보내기">
        <RadioGroup
          label="이 주소의 계정"
          options={[
            { value: 'yes', label: '계정 있음' },
            { value: 'no', label: '계정 없음' },
          ]}
          value={accountExists}
          onValueChange={setAccountExists}
        />
        <div className="tm-resend__actions">
          <Button variant="secondary" size="sm" onClick={requestResend}>
            다시 보내기
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setNow((n) => n + 1)}>
            1분 지나기
          </Button>
          <span className="tm-resend__clock">지금 {now}분 (예시)</span>
        </div>
        {lastResend && (
          <div className="tm-resend__result">
            <p className="tm-lab__notice">{lastResend.message}</p>
            <p className="tm-lab__note">
              실제 발송: {lastResend.mailSent ? '있음' : '없음'} — 사용자 화면에는 나오지 않아요.
            </p>
          </div>
        )}
      </section>

      <p className="tm-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
