export type Kind = 'active' | 'device-off' | 'expired';
export type Outcome = 'delivered' | 'delivered-after-wait' | 'dropped' | 'deleted';

export interface Subscription {
  readonly id: string;
  readonly label: string;
  readonly kind: Kind;
  /** device-off 에서 기기가 다시 연결되는 틱(예시). active 는 0, expired 는 쓰지 않아요 */
  readonly reachableFrom: number;
}

export interface Params {
  /** 발송 시각. 틱은 시뮬레이터의 시간 단위예요 */
  readonly sendAt: number;
  /** TTL. 0 이면 기기가 이미 연결된 때만 전달해요 */
  readonly ttl: number;
}

export interface Verdict {
  readonly subscription: Subscription;
  readonly outcome: Outcome;
  /** 전달 또는 버림이 일어나는 틱. 구독을 지우는 경우는 null */
  readonly at: number | null;
}

export interface Summary {
  readonly verdicts: readonly Verdict[];
  readonly counts: Readonly<Record<Outcome, number>>;
}

export const SUBSCRIPTIONS: readonly Subscription[] = [
  { id: 'laptop', label: '노트북 브라우저 (정상)', kind: 'active', reachableFrom: 0 },
  { id: 'phone', label: '휴대폰 (잠깐 꺼짐, 예시)', kind: 'device-off', reachableFrom: 12 },
  { id: 'tablet', label: '태블릿 (오래 꺼짐, 예시)', kind: 'device-off', reachableFrom: 40 },
  { id: 'old', label: '옛 구독 (만료, 예시)', kind: 'expired', reachableFrom: 0 },
];

/**
 * 구독 하나에 대한 결과.
 * - 만료된 구독은 TTL과 상관없이 404로 응답하고, 앱 서버는 그 구독을 지워요.
 * - 기기가 TTL 안에 켜지면 그때 전달해요. TTL이 지나면 전달을 시도하지 않아요.
 */
export function judge(sub: Subscription, { sendAt, ttl }: Params): Verdict {
  if (sub.kind === 'expired') return { subscription: sub, outcome: 'deleted', at: null };

  const reachAt = Math.max(sendAt, sub.reachableFrom);
  const waited = reachAt - sendAt;
  if (waited === 0) return { subscription: sub, outcome: 'delivered', at: sendAt };
  if (waited < ttl) return { subscription: sub, outcome: 'delivered-after-wait', at: reachAt };
  return { subscription: sub, outcome: 'dropped', at: sendAt + ttl };
}

export function simulate(params: Params, subs: readonly Subscription[] = SUBSCRIPTIONS): Summary {
  const verdicts = subs.map((s) => judge(s, params));
  const counts: Record<Outcome, number> = {
    delivered: 0,
    'delivered-after-wait': 0,
    dropped: 0,
    deleted: 0,
  };
  for (const v of verdicts) counts[v.outcome] += 1;
  return { verdicts, counts };
}
