/** 발송 채널. 동의는 채널마다 따로 저장해요 */
export type Channel = 'email' | 'sms' | 'push';
/** transactional: 주문 · 보안 같은 거래 알림. marketing: 쿠폰 · 이벤트 같은 광고성 메시지 */
export type Kind = 'transactional' | 'marketing';
/** 동의를 확인하는 시점. create: 요청을 만들 때만 · send: 발송 직전에 다시 */
export type CheckAt = 'create' | 'send';
/** 설정 화면 토글, 원클릭 수신 거부, 토큰이 틀린 위조 요청, 다른 채널 토글 */
export type Event = 'none' | 'email-off' | 'one-click-email' | 'forged-one-click' | 'sms-off';

/** 채널별 마케팅 동의 현재 값 */
export type Consent = Record<'email' | 'sms' | 'push', boolean>;

export interface Queued {
  id: string;
  label: string;
  channel: Channel;
  kind: Kind;
}

export interface Item {
  id: string;
  label: string;
  status: 'sent' | 'blocked';
  /** 동의를 거둔 뒤에 나간 마케팅 메시지 */
  violation: boolean;
  reason: string;
}

export interface Result {
  items: Item[];
  sent: number;
  blocked: number;
  violations: number;
}

export const INITIAL_CONSENT: Consent = { email: true, sms: true, push: true };

/** 요청 생성 시점(T0)에 예약된 메시지 목록. 발송은 T1 에 일어나요 (예시) */
export const QUEUE: readonly Queued[] = [
  { id: 'mail-promo', label: '메일 · 쿠폰 안내 (마케팅)', channel: 'email', kind: 'marketing' },
  { id: 'sms-promo', label: '문자 · 이벤트 안내 (마케팅)', channel: 'sms', kind: 'marketing' },
  { id: 'mail-order', label: '메일 · 주문 확인 (거래)', channel: 'email', kind: 'transactional' },
];

export const EVENT_LABEL: Record<Event, string> = {
  none: '아무 일도 없어요',
  'email-off': '설정에서 메일 마케팅 끄기',
  'one-click-email': '메일 아래 원클릭 수신 거부',
  'forged-one-click': '토큰이 틀린 위조 요청',
  'sms-off': '설정에서 문자 마케팅 끄기',
};

export const CHECK_LABEL: Record<CheckAt, string> = {
  create: '요청 생성 시에만 확인',
  send: '발송 직전에 다시 확인',
};

/** T0 → T1 사이에 일어난 사건을 적용한 동의 상태. 위조 요청은 상태를 바꾸지 않아요 */
export const applyEvent = (consent: Consent, event: Event): Consent => {
  switch (event) {
    case 'email-off':
    case 'one-click-email':
      return { ...consent, email: false };
    case 'sms-off':
      return { ...consent, sms: false };
    default:
      return consent;
  }
};

/** 예약된 메시지 하나를 발송 시점에 어떻게 처리할지 계산해요 */
export const simulate = (checkAt: CheckAt, event: Event): Result => {
  const atCreate = INITIAL_CONSENT;
  const atSend = applyEvent(INITIAL_CONSENT, event);

  const items: Item[] = QUEUE.map((q) => {
    if (q.kind === 'transactional') {
      return {
        id: q.id,
        label: q.label,
        status: 'sent',
        violation: false,
        reason: '거래 알림은 마케팅 동의와 상관없이 나가요',
      };
    }

    const consentChecked = checkAt === 'create' ? atCreate[q.channel] : atSend[q.channel];
    if (!consentChecked) {
      return {
        id: q.id,
        label: q.label,
        status: 'blocked',
        violation: false,
        reason: '발송 직전 동의가 꺼져 있어 막았어요',
      };
    }

    const violation = !atSend[q.channel];
    return {
      id: q.id,
      label: q.label,
      status: 'sent',
      violation,
      reason: violation ? '동의를 거둔 뒤에 나갔어요 (위반)' : '동의가 유지되어 나갔어요',
    };
  });

  return {
    items,
    sent: items.filter((i) => i.status === 'sent').length,
    blocked: items.filter((i) => i.status === 'blocked').length,
    violations: items.filter((i) => i.violation).length,
  };
};
