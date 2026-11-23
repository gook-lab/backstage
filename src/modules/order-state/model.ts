/** 주문 상태 값. DB enum 과 같은 목록이에요 */
export const STATUSES = [
  'pending_payment',
  'paid',
  'preparing',
  'shipping',
  'delivered',
  'canceled',
  'refund_pending',
  'refunded',
] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIONS = ['pay_succeeded', 'cancel', 'prepare', 'ship', 'deliver', 'refund_done'] as const;
export type Action = (typeof ACTIONS)[number];

/** 요청을 보낸 쪽. 손님 · 창고 직원은 요청, 결제사 · 택배사는 웹훅으로 통지해요 */
export type Actor = 'customer' | 'warehouse' | 'webhook';

/** 판정 방식 — 화면에서만 막기 · 서버 확인 후 쓰기 · 조건부 UPDATE */
export type Mode = 'ui-only' | 'check-then-write' | 'conditional';

export const STATUS_LABEL: Record<Status, string> = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  preparing: '배송 준비',
  shipping: '배송 중',
  delivered: '배송 완료',
  canceled: '취소',
  refund_pending: '환불 대기',
  refunded: '환불 완료',
};

export const ACTION_LABEL: Record<Action, string> = {
  pay_succeeded: '결제 완료 통지',
  cancel: '취소 요청',
  prepare: '출고 준비',
  ship: '출고 처리',
  deliver: '배송 완료 통지',
  refund_done: '환불 완료 통지',
};

export const ACTOR_LABEL: Record<Actor, string> = {
  customer: '손님',
  warehouse: '창고',
  webhook: '결제사 · 택배사',
};

export const MODE_LABEL: Record<Mode, string> = {
  'ui-only': '화면에서만 막기',
  'check-then-write': '서버 확인 후 쓰기',
  conditional: '조건부 UPDATE',
};

export interface Transition {
  readonly action: Action;
  readonly from: Status;
  readonly to: Status;
}

/** 허용 전이 표. 이 표에 없는 조합은 모두 거부해요 */
export const TRANSITIONS: readonly Transition[] = [
  { action: 'pay_succeeded', from: 'pending_payment', to: 'paid' },
  { action: 'cancel', from: 'pending_payment', to: 'canceled' },
  { action: 'prepare', from: 'paid', to: 'preparing' },
  { action: 'cancel', from: 'paid', to: 'refund_pending' },
  { action: 'ship', from: 'preparing', to: 'shipping' },
  { action: 'cancel', from: 'preparing', to: 'refund_pending' },
  { action: 'deliver', from: 'shipping', to: 'delivered' },
  { action: 'refund_done', from: 'refund_pending', to: 'refunded' },
];

/** 화면에서만 막는 서버가 각 동작에 쓰는 값. 전이 표를 보지 않아요 */
const NAIVE_VALUE: Record<Action, Status> = {
  pay_succeeded: 'paid',
  cancel: 'canceled',
  prepare: 'preparing',
  ship: 'shipping',
  deliver: 'delivered',
  refund_done: 'refunded',
};

export function nextStatus(from: Status, action: Action): Status | null {
  return TRANSITIONS.find((t) => t.from === from && t.action === action)?.to ?? null;
}

export function isValidTransition(from: Status, to: Status): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/** 서버가 내려 주는 가능한 동작. FE 버튼은 이 목록으로만 그려요 */
export function allowedActions(status: Status): Action[] {
  return ACTIONS.filter((a) => nextStatus(status, a) !== null);
}

export interface Request {
  readonly id: string;
  readonly label: string;
  readonly actor: Actor;
  readonly action: Action;
  /** 같은 group 번호의 요청은 같은 시점에 도착해서 같은 옛 상태를 읽어요 */
  readonly group: number;
}

export interface Scenario {
  readonly id: string;
  readonly label: string;
  readonly start: Status;
  readonly requests: readonly Request[];
}

export interface Response {
  readonly requestId: string;
  /** 200: 반영됨 또는 웹훅 무시 · 409: 거부 */
  readonly status: 200 | 409;
  /** 웹훅이 규칙에 어긋나 버려진 경우. 2xx 로 받고 상태는 그대로 둬요 */
  readonly ignored: boolean;
  /** 응답 본문에 담는 현재 상태 */
  readonly current: Status;
}

export interface HistoryEntry {
  readonly requestId: string;
  readonly actor: Actor;
  readonly from: Status;
  readonly to: Status;
}

export interface Result {
  readonly finalStatus: Status;
  readonly responses: readonly Response[];
  readonly history: readonly HistoryEntry[];
  /** 허용 전이 표에 없는 변경이 기록된 횟수 */
  readonly wrongTransitions: number;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'cancel-while-shipping',
    label: '배송 중에 취소 요청',
    start: 'shipping',
    requests: [{ id: 'cancel', label: '손님 취소 요청', actor: 'customer', action: 'cancel', group: 0 }],
  },
  {
    id: 'late-payment',
    label: '늦게 온 결제 완료 통지',
    start: 'preparing',
    requests: [{ id: 'pay', label: '결제 완료 통지', actor: 'webhook', action: 'pay_succeeded', group: 0 }],
  },
  {
    id: 'cancel-and-ship',
    label: '취소와 출고가 동시에',
    start: 'preparing',
    requests: [
      { id: 'ship', label: '창고 출고 처리', actor: 'warehouse', action: 'ship', group: 0 },
      { id: 'cancel', label: '손님 취소 요청', actor: 'customer', action: 'cancel', group: 0 },
    ],
  },
  {
    id: 'double-cancel',
    label: '취소 버튼을 두 번 누름',
    start: 'paid',
    requests: [
      { id: 'cancel-1', label: '손님 취소 요청 (첫 번째)', actor: 'customer', action: 'cancel', group: 0 },
      { id: 'cancel-2', label: '손님 취소 요청 (두 번째)', actor: 'customer', action: 'cancel', group: 0 },
    ],
  },
];

/** 요청을 mode 방식으로 처리한 결과. 같은 group 은 시작 시점의 옛 상태를 함께 읽어요 */
export function run(scenario: Scenario, mode: Mode): Result {
  let db: Status = scenario.start;
  const responses: Response[] = [];
  const history: HistoryEntry[] = [];
  let wrongTransitions = 0;
  const groups = [...new Set(scenario.requests.map((r) => r.group))].sort((a, b) => a - b);

  for (const group of groups) {
    const snapshot = db;
    for (const req of scenario.requests.filter((r) => r.group === group)) {
      if (mode === 'ui-only') {
        const to = NAIVE_VALUE[req.action];
        if (!isValidTransition(db, to)) wrongTransitions += 1;
        history.push({ requestId: req.id, actor: req.actor, from: db, to });
        db = to;
        responses.push({ requestId: req.id, status: 200, ignored: false, current: to });
        continue;
      }

      const basis = mode === 'check-then-write' ? snapshot : db;
      const to = nextStatus(basis, req.action);
      if (to === null) {
        const webhook = req.actor === 'webhook';
        responses.push({ requestId: req.id, status: webhook ? 200 : 409, ignored: webhook, current: basis });
        continue;
      }
      if (!isValidTransition(db, to)) wrongTransitions += 1;
      history.push({ requestId: req.id, actor: req.actor, from: db, to });
      db = to;
      responses.push({ requestId: req.id, status: 200, ignored: false, current: to });
    }
  }

  return {
    finalStatus: db,
    responses,
    history,
    wrongTransitions,
  };
}
