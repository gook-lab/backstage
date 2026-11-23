/** 사용 취소 때 이미 만료된 묶음 몫을 어떻게 할지. 회사 정책이 아니라 예시 정책이에요 */
export type ExpiryPolicy = 'none' | 'restore-expire' | 'extend';

export const EXPIRY_POLICIES: readonly ExpiryPolicy[] = ['none', 'restore-expire', 'extend'];
export const EXPIRY_POLICY_LABEL: Record<ExpiryPolicy, string> = {
  none: '복원 안 함',
  'restore-expire': '복원 후 즉시 소멸',
  extend: '유효기간 연장',
};

/** 연장 정책에서 취소한 날부터 더해지는 일수 (예시 값) */
export const EXTEND_DAYS = 30;
/** 시뮬레이터가 보여 주는 마지막 날. 모든 묶음이 이 날 전에 끝나도록 잡아요 */
export const DAY_MAX = 160;

export const LOT_IDS = ['A', 'B', 'C'] as const;

export interface Lot {
  readonly id: string;
  /** 적립 금액 (정수 P) */
  readonly amount: number;
  /** 이 날까지 쓸 수 있어요. 다음 날부터 만료예요 */
  readonly expiresDay: number;
}

export interface Params {
  readonly lots: readonly Lot[];
  readonly useAmount: number;
  readonly useDay: number;
  readonly cancel: boolean;
  readonly cancelDay: number;
  readonly policy: ExpiryPolicy;
  readonly viewDay: number;
}

export type RowKind = 'earn' | 'use' | 'restore' | 'expire' | 'extend';

export interface LedgerRow {
  readonly day: number;
  readonly kind: RowKind;
  readonly lotId: string;
  /** 부호가 있는 변화량. 적립과 복원은 +, 사용과 만료는 - */
  readonly amount: number;
  readonly balanceAfter: number;
}

export interface Allocation {
  readonly lotId: string;
  readonly amount: number;
}

export interface Forfeit {
  readonly day: number;
  readonly lotId: string;
  readonly amount: number;
}

export interface Result {
  readonly insufficient: boolean;
  /** 잔액이 모자라 사용하지 못한 금액 */
  readonly shortBy: number;
  readonly canceled: boolean;
  readonly allocations: readonly Allocation[];
  readonly ledger: readonly LedgerRow[];
  /** viewDay 까지의 원장 합계 */
  readonly balanceAt: number;
  readonly lotBalanceAt: Readonly<Record<string, number>>;
  /** viewDay 까지 만료로 소멸한 금액 */
  readonly expiredAt: number;
  /** viewDay 까지 취소 때 복원하지 않은 금액 */
  readonly notRestoredAt: number;
}

function assertInt(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} 은 정수여야 해요: ${value}`);
  }
}

function validate(p: Params): void {
  const ids = new Set(p.lots.map((l) => l.id));
  if (ids.size !== p.lots.length) throw new RangeError('묶음 id 가 겹쳐요');
  for (const lot of p.lots) {
    assertInt(lot.amount, `${lot.id} 금액`);
    assertInt(lot.expiresDay, `${lot.id} 만료일`);
    if (lot.amount < 0) throw new RangeError(`${lot.id} 금액은 0 이상이어야 해요`);
  }
  assertInt(p.useAmount, '사용 금액');
  assertInt(p.useDay, '사용 날짜');
  assertInt(p.cancelDay, '취소 날짜');
  assertInt(p.viewDay, '확인 날짜');
  if (p.useAmount < 1) throw new RangeError('사용 금액은 1 이상이어야 해요');
  if (p.cancel && p.cancelDay < p.useDay) throw new RangeError('취소는 사용 날짜 이후여야 해요');
}

/**
 * 원장 한 벌을 만든다. 하루씩 진행하며 만료 → 사용 → 취소 순서로 처리한다.
 * 만료 묶음은 만료일 다음 날 남은 금액 전부가 소멸한다.
 */
export function simulate(p: Params): Result {
  validate(p);

  const lots = p.lots.map((l) => ({ id: l.id, expiresDay: l.expiresDay, remaining: l.amount }));
  const ledger: LedgerRow[] = [];
  const forfeits: Forfeit[] = [];
  let balance = 0;
  const post = (day: number, kind: RowKind, lotId: string, amount: number) => {
    balance += amount;
    ledger.push({ day, kind, lotId, amount, balanceAfter: balance });
  };

  for (const lot of p.lots) post(0, 'earn', lot.id, lot.amount);

  let insufficient = false;
  let shortBy = 0;
  let used = false;
  const allocations: Allocation[] = [];

  for (let day = 1; day <= DAY_MAX; day++) {
    for (const lot of lots) {
      if (lot.remaining > 0 && lot.expiresDay < day) {
        post(day, 'expire', lot.id, -lot.remaining);
        lot.remaining = 0;
      }
    }

    if (day === p.useDay) {
      // 만료 임박 순. 같은 만료일이면 묶음 순서를 따라요. sort 는 안정 정렬이에요
      const order = lots.filter((l) => l.remaining > 0).sort((a, b) => a.expiresDay - b.expiresDay);
      const available = order.reduce((sum, l) => sum + l.remaining, 0);
      if (available < p.useAmount) {
        insufficient = true;
        shortBy = p.useAmount - available;
      } else {
        let need = p.useAmount;
        for (const lot of order) {
          if (need === 0) break;
          const take = Math.min(need, lot.remaining);
          lot.remaining -= take;
          need -= take;
          post(day, 'use', lot.id, -take);
          allocations.push({ lotId: lot.id, amount: take });
        }
        used = true;
      }
    }

    if (used && p.cancel && day === p.cancelDay) {
      for (const a of allocations) {
        const lot = lots.find((l) => l.id === a.lotId);
        if (!lot) throw new Error(`알 수 없는 묶음: ${a.lotId}`);
        const expired = lot.expiresDay < day;
        if (!expired) {
          lot.remaining += a.amount;
          post(day, 'restore', lot.id, a.amount);
          continue;
        }
        if (p.policy === 'none') {
          forfeits.push({ day, lotId: lot.id, amount: a.amount });
        } else if (p.policy === 'restore-expire') {
          post(day, 'restore', lot.id, a.amount);
          post(day, 'expire', lot.id, -a.amount);
        } else {
          lot.remaining += a.amount;
          lot.expiresDay = day + EXTEND_DAYS;
          post(day, 'restore', lot.id, a.amount);
          post(day, 'extend', lot.id, 0);
        }
      }
    }
  }

  const rowsAt = ledger.filter((r) => r.day <= p.viewDay);
  const sumAt = (pred: (r: LedgerRow) => boolean) => rowsAt.filter(pred).reduce((sum, r) => sum + r.amount, 0);

  const lotBalanceAt: Record<string, number> = {};
  for (const lot of p.lots) lotBalanceAt[lot.id] = sumAt((r) => r.lotId === lot.id);

  return {
    insufficient,
    shortBy,
    canceled: used && p.cancel,
    allocations,
    ledger,
    balanceAt: sumAt(() => true),
    lotBalanceAt,
    expiredAt: -sumAt((r) => r.kind === 'expire'),
    notRestoredAt: forfeits.filter((f) => f.day <= p.viewDay).reduce((sum, f) => sum + f.amount, 0),
  };
}
