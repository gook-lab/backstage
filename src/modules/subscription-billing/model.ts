/**
 * 구독 결제 모델 (이 모델 기준)
 *
 * - 금액은 정수 원 단위로 계산해요. 실수 나눗셈 결과는 Math.round 로 반올림해요(양수는 0.5 올림).
 * - 청구 주기는 30일로 고정해요. 실제 Stripe는 초 단위로 일할 계산해요(Prorations 문서).
 * - 변경일 d(1~30)는 주기의 d번째 날 시작 시점이에요. 남은 일수는 31 - d 예요.
 * - 결제 실패 시점은 청구일을 0일로 두고, 재시도 간격은 이전 시도로부터 며칠 뒤인지로 적어요.
 */

export const PERIOD_DAYS = 30;
export const HORIZON = 30;

export type PlanId = 'basic' | 'pro' | 'team';
export const PLAN_IDS: readonly PlanId[] = ['basic', 'pro', 'team'];
export const PLAN_LABEL: Record<PlanId, string> = {
  basic: '베이직',
  pro: '프로',
  team: '팀',
};
export const PLAN_PRICE_WON: Record<PlanId, number> = {
  basic: 9900,
  pro: 19900,
  team: 29900,
};

export type ProrationMode = 'immediate' | 'next-invoice' | 'none';
export const PRORATION_MODES: readonly ProrationMode[] = ['immediate', 'next-invoice', 'none'];
export const PRORATION_LABEL: Record<ProrationMode, string> = {
  immediate: '즉시 청구',
  'next-invoice': '다음 청구서에 넣기',
  none: '일할 계산 없음',
};

export interface ProrationInput {
  readonly fromPrice: number;
  readonly toPrice: number;
  /** 1~30. 범위를 벗어나면 가장 가까운 값으로 맞춰요 */
  readonly changeDay: number;
  readonly mode: ProrationMode;
}

export interface ProrationResult {
  readonly changeDay: number;
  readonly remainingDays: number;
  /** 기존 플랜의 미사용분 (크레딧). 양수로 적어요 */
  readonly creditOld: number;
  /** 새 플랜의 남은 기간 (차감). 양수로 적어요 */
  readonly debitNew: number;
  /** debitNew - creditOld. 음수면 크레딧이에요 */
  readonly net: number;
  /** 변경 즉시 청구하는 금액 */
  readonly chargeNow: number;
  /** 아직 쓰지 않은 크레딧 잔액 */
  readonly creditBalance: number;
  /** 다음 청구서에 찍히는 금액 (새 플랜 정가 + 일할 조정) */
  readonly nextInvoice: number;
}

export function clampChangeDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(PERIOD_DAYS, Math.max(1, Math.round(day)));
}

/** 남은 기간에 맞춘 금액 비율을 정수 원으로 반올림해요. */
export function prorate(price: number, remainingDays: number): number {
  return Math.round((price * remainingDays) / PERIOD_DAYS);
}

export function computeProration(input: ProrationInput): ProrationResult {
  const changeDay = clampChangeDay(input.changeDay);
  const remainingDays = PERIOD_DAYS + 1 - changeDay;

  if (input.mode === 'none') {
    // 일할 계산을 끄면 이번 주기에는 차액이 생기지 않고, 다음 청구는 새 플랜 정가예요.
    return {
      changeDay,
      remainingDays,
      creditOld: 0,
      debitNew: 0,
      net: 0,
      chargeNow: 0,
      creditBalance: 0,
      nextInvoice: input.toPrice,
    };
  }

  const creditOld = prorate(input.fromPrice, remainingDays);
  const debitNew = prorate(input.toPrice, remainingDays);
  const net = debitNew - creditOld;

  if (input.mode === 'immediate') {
    // 차액이 양수면 바로 청구해요. 음수는 환불하지 않고 크레딧 잔액으로 남겨요.
    return {
      changeDay,
      remainingDays,
      creditOld,
      debitNew,
      net,
      chargeNow: Math.max(0, net),
      creditBalance: Math.max(0, -net),
      nextInvoice: input.toPrice,
    };
  }

  // next-invoice: 차액을 다음 청구서에 더해요. 합계가 음수면 남은 금액은 크레딧으로 넘겨요.
  const total = input.toPrice + net;
  return {
    changeDay,
    remainingDays,
    creditOld,
    debitNew,
    net,
    chargeNow: 0,
    creditBalance: Math.max(0, -total),
    nextInvoice: Math.max(0, total),
  };
}

// ---------- 결제 실패 · 재시도 · 유예 ----------

export type RetryPlan = 'none' | 'short' | 'wide';
export const RETRY_PLANS: readonly RetryPlan[] = ['none', 'short', 'wide'];
export const RETRY_LABEL: Record<RetryPlan, string> = {
  none: '재시도 없음',
  short: '짧게 3회 (1 · 2 · 3일 간격)',
  wide: '넓게 3회 (3 · 5 · 7일 간격)',
};
/** 이전 시도로부터 며칠 뒤에 재시도하는지. Stripe 커스텀 규칙은 최대 3회예요 */
export const RETRY_GAPS: Record<RetryPlan, readonly number[]> = {
  none: [],
  short: [1, 2, 3],
  wide: [3, 5, 7],
};

export type FinalOutcome = 'past_due' | 'unpaid' | 'canceled';
export const FINAL_OUTCOMES: readonly FinalOutcome[] = ['past_due', 'unpaid', 'canceled'];
export const FINAL_LABEL: Record<FinalOutcome, string> = {
  past_due: '마지막 재시도 뒤에도 past_due 유지',
  unpaid: 'unpaid 로 바꾸기',
  canceled: 'canceled 로 바꾸기',
};

export type SubStatus = 'active' | 'past_due' | 'unpaid' | 'canceled';

export const GRACE_OPTIONS: readonly number[] = [0, 3, 7, 14];

export interface DunningInput {
  readonly retryPlan: RetryPlan;
  /** 0 이면 재시도가 모두 실패해요. 1 이상이면 그 번째 재시도에서 성공해요 */
  readonly recoverAt: number;
  readonly finalOutcome: FinalOutcome;
  /** 첫 실패 뒤 기능을 유지하는 일수. 0 이면 실패 즉시 차단해요 */
  readonly graceDays: number;
}

export interface DayRow {
  readonly day: number;
  readonly attempt: boolean;
  readonly status: SubStatus;
  readonly access: boolean;
}

export interface DunningResult {
  /** 청구 시도 날짜 목록. 첫 번째(0일)는 최초 청구예요 */
  readonly attemptDays: readonly number[];
  readonly recoveredOn: number | null;
  readonly finalStartDay: number;
  readonly days: readonly DayRow[];
  /** 기능이 처음 막히는 날. 끝까지 열려 있으면 null */
  readonly blockedFrom: number | null;
  readonly accessDaysCount: number;
}

/** 재시도 간격으로 시도 날짜를 만들어요. 0일이 최초 청구예요. */
export function attemptDaysOf(plan: RetryPlan): number[] {
  const days = [0];
  let cursor = 0;
  for (const gap of RETRY_GAPS[plan]) {
    cursor += gap;
    days.push(cursor);
  }
  return days;
}

/** 고를 수 있는 재시도 성공 번호. 0 은 모두 실패예요. */
export function recoverOptions(plan: RetryPlan): number[] {
  return [0, ...RETRY_GAPS[plan].map((_, i) => i + 1)];
}

export function simulateDunning(input: DunningInput): DunningResult {
  const attemptDays = attemptDaysOf(input.retryPlan);
  const options = recoverOptions(input.retryPlan);
  const recoverAt = options.includes(input.recoverAt) ? input.recoverAt : 0;
  const lastAttempt = attemptDays[attemptDays.length - 1];
  // 마지막 재시도가 끝난 다음 날부터 최종 결과를 적용해요. 모델 기준이에요.
  const finalStartDay = lastAttempt + 1;
  const recoveredOn = recoverAt > 0 ? attemptDays[recoverAt] : null;

  const days: DayRow[] = [];
  let blockedFrom: number | null = null;
  let accessDaysCount = 0;

  for (let day = 0; day <= HORIZON; day++) {
    let status: SubStatus;
    if (recoveredOn !== null && day >= recoveredOn) {
      status = 'active';
    } else if (day >= finalStartDay) {
      status = input.finalOutcome;
    } else {
      status = 'past_due';
    }

    const access = status === 'active' || (status === 'past_due' && day < input.graceDays);
    if (access) accessDaysCount += 1;
    else if (blockedFrom === null) blockedFrom = day;

    days.push({ day, attempt: attemptDays.includes(day), status, access });
  }

  return {
    attemptDays,
    recoveredOn,
    finalStartDay,
    days,
    blockedFrom,
    accessDaysCount,
  };
}
