/** 수신 측 상태. ok: 250 수락 · busy: 4yz 일시 거절 · missing: 5yz 없는 메일함 */
export type Recipient = 'ok' | 'busy' | 'missing';
export type SpfResult = 'pass' | 'fail';
export type DkimResult = 'pass' | 'fail';
export type DmarcPolicy = 'none' | 'quarantine' | 'reject';
export type RetryPolicy = 'none' | 'fixed' | 'backoff';
export type Outcome = 'delivered' | 'retried' | 'spam' | 'bounced' | 'lost';

export interface Sender {
  spf: SpfResult;
  dkim: DkimResult;
  /** From 도메인이 SPF 의 MAIL FROM 또는 DKIM 의 d= 도메인과 맞는지 */
  aligned: boolean;
  dmarc: DmarcPolicy;
}

export interface Params {
  recipient: Recipient;
  /** 4yz 일시 거절이 이어지는 시간 (분, 예시) */
  busyMinutes: number;
  sender: Sender;
  retry: RetryPolicy;
}

export interface Attempt {
  minute: number;
  reply: 'ok' | '4yz' | '5yz';
}

export interface MailResult {
  outcome: Outcome;
  attempts: Attempt[];
  deliveredAt: number | null;
  /** 운영 기록. 사용자 화면에는 보내지 않아요 */
  log: string;
}

/** 시도 시각 (분, 예시). 지수 백오프는 1 → 2 → 4 → 8 간격 */
export const RETRY_MINUTES: Record<RetryPolicy, readonly number[]> = {
  none: [0],
  fixed: [0, 3, 6, 9, 12],
  backoff: [0, 1, 3, 7, 15],
};

export const HORIZON = 30;
export const BUSY_RANGE = { min: 1, max: 20 } as const;

export const RECIPIENT_LABEL: Record<Recipient, string> = {
  ok: '정상 (250 수락)',
  busy: '일시 거절 (451)',
  missing: '없는 주소 (550 5.1.1)',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  delivered: '전달',
  retried: '재시도 후 전달',
  spam: '스팸함 가능성',
  bounced: '반송',
  lost: '유실 (사용자 미통지)',
};

/** 사용자 화면 문구. 결과와 무관하게 같아요. 발송 결과를 화면에 드러내지 않기 위해서예요 */
export const RESEND_NOTICE = '입력하신 주소로 인증 메일을 보냈어요. 몇 분 안에 도착하지 않으면 스팸함도 확인해 주세요.';

export const dmarcPass = (s: Sender): boolean => s.aligned && (s.spf === 'pass' || s.dkim === 'pass');

export function simulateMail(p: Params): MailResult {
  if (p.recipient === 'missing') {
    return {
      outcome: 'bounced',
      attempts: [{ minute: 0, reply: '5yz' }],
      deliveredAt: null,
      log: '550 5.1.1 — 없는 메일함이에요. 영구 실패라 재시도하지 않고 반송해요.',
    };
  }
  if (p.sender.dmarc === 'reject' && !dmarcPass(p.sender)) {
    return {
      outcome: 'bounced',
      attempts: [{ minute: 0, reply: '5yz' }],
      deliveredAt: null,
      log: 'DMARC 정책 reject 와 인증 실패 — 수신 측이 거절하고 반송해요.',
    };
  }

  const attempts: Attempt[] = [];
  let deliveredAt: number | null = null;
  for (const minute of RETRY_MINUTES[p.retry]) {
    if (minute >= HORIZON) break;
    if (p.recipient === 'busy' && minute < p.busyMinutes) {
      attempts.push({ minute, reply: '4yz' });
      continue;
    }
    attempts.push({ minute, reply: 'ok' });
    deliveredAt = minute;
    break;
  }

  if (deliveredAt === null) {
    return {
      outcome: 'lost',
      attempts,
      deliveredAt,
      log: `재시도 ${attempts.length}번이 모두 4yz 로 끝났어요. RFC 5321 은 포기까지 최소 4~5일을 권하지만, 이 모델은 짧게 줄였어요(예시). 반송 알림이 오지 않아 사용자는 모를 수 있어요.`,
    };
  }

  const spam = p.sender.dmarc === 'quarantine' && !dmarcPass(p.sender);
  if (spam) {
    return {
      outcome: 'spam',
      attempts,
      deliveredAt,
      log: 'DMARC 인증 실패 · quarantine 정책 — 수신 측이 스팸함으로 보냈을 가능성이 있어요.',
    };
  }
  if (attempts.length > 1) {
    return {
      outcome: 'retried',
      attempts,
      deliveredAt,
      log: `${attempts.length}번째 시도(${deliveredAt}분, 예시)에 수락되었어요. 앞선 시도는 4yz 였어요.`,
    };
  }
  return {
    outcome: 'delivered',
    attempts,
    deliveredAt,
    log: '250 수락 — 첫 시도에 전달했어요.',
  };
}

export interface ResendInput {
  /** 계정이 있는지. 응답과 쿨다운 계산에는 쓰지 않고, 실제 발송 여부만 바꿔요 */
  accountExists: boolean;
  /** 이 주소에 대해 마지막으로 요청을 받은 시각 (계정 존재와 무관하게 기록) */
  lastRequestedAt: number | null;
  now: number;
  /** 쿨다운 (분, 예시) */
  cooldown: number;
}

export interface ResendResult {
  message: string;
  mailSent: boolean;
  waitMinutes: number;
}

export const cooldownMessage = (wait: number): string =>
  `잠시 후 다시 보낼 수 있어요. ${wait}분 뒤에 다시 눌러 주세요.`;

/** 같은 주소에 대한 요청은 계정 존재와 무관하게 같은 쿨다운과 같은 응답을 받아요 */
export function resendRequest(i: ResendInput): ResendResult {
  const waitMinutes = i.lastRequestedAt === null ? 0 : Math.max(0, i.lastRequestedAt + i.cooldown - i.now);
  if (waitMinutes > 0) {
    return { message: cooldownMessage(waitMinutes), mailSent: false, waitMinutes };
  }
  return { message: RESEND_NOTICE, mailSent: i.accountExists, waitMinutes: 0 };
}
