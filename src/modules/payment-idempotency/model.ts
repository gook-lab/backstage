export type Protection = 'none' | 'key' | 'key-webhook';
export type TimeoutPolicy = 'wait' | 'resubmit' | 'poll';
export type OrderStatus = 'CREATED' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED' | 'CANCELED';
export type ClientView = 'unknown' | 'confirmed' | 'rejected';
export type Lane = 'client' | 'server' | 'provider' | 'webhook' | 'network';
export type WebhookEventType = 'payment.succeeded' | 'payment.failed';
export type Why = 'first' | 'double-click' | 'retry';

export interface Config {
  readonly doubleClick: boolean;
  readonly timeoutPolicy: TimeoutPolicy;
  readonly retryChangesBody: boolean;
  readonly lossPercent: number;
  readonly seed: number;
  readonly webhookDuplicates: boolean;
  readonly protection: Protection;
}

export interface Reply {
  readonly code: 200 | 409 | 422;
  readonly order: OrderStatus;
}

export interface SimEvent {
  readonly t: number;
  readonly lane: Lane;
  readonly text: string;
}

export interface Result {
  readonly events: readonly SimEvent[];
  readonly sends: number;
  readonly providerCharges: number;
  readonly chargedAmounts: readonly number[];
  readonly orderStatus: OrderStatus;
  readonly paidOrders: number;
  readonly notifications: number;
  readonly duplicateWebhooksProcessed: number;
  readonly clientView: ClientView;
}

export const PRICE = 10000;
export const COUPON_PRICE = 9000;
export const IDEM_KEY = 'ck_7f3a';
export const MAX_RESUBMITS = 1;
export const MAX_POLLS = 4;

const LEG = 1;
const CHARGE_TICKS = 2;
const TIMEOUT_TICKS = 5;
const POLL_INTERVAL = 2;

export const DEFAULT_CONFIG: Config = {
  doubleClick: false,
  timeoutPolicy: 'wait',
  retryChangesBody: false,
  lossPercent: 0,
  seed: 7,
  webhookDuplicates: false,
  protection: 'none',
};

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly config: Config;
}

const preset = (id: string, label: string, patch: Partial<Config>): Preset => ({
  id,
  label,
  config: { ...DEFAULT_CONFIG, ...patch },
});

export const PRESETS: readonly Preset[] = [
  preset('double-click', '더블 클릭 · 보호 없음', { doubleClick: true }),
  preset('lost-retry', '응답 유실 · 자동 재전송 · 보호 없음', { lossPercent: 100, timeoutPolicy: 'resubmit' }),
  preset('lost-key', '응답 유실 · 자동 재전송 · 멱등성 키', {
    lossPercent: 100,
    timeoutPolicy: 'resubmit',
    protection: 'key',
  }),
  preset('poll', '응답 유실 · 상태 조회 · 멱등성 키', { lossPercent: 100, timeoutPolicy: 'poll', protection: 'key' }),
  preset('webhook', '웹훅 중복 · 멱등성 키', { webhookDuplicates: true, protection: 'key' }),
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fingerprint(amount: number): string {
  return `order-1001:${amount}`;
}

export type IdemRecord =
  | { readonly hash: string; readonly state: 'in-progress' }
  | { readonly hash: string; readonly state: 'done'; readonly reply: Reply };

export type Decision =
  | { readonly kind: 'start' }
  | { readonly kind: 'replay'; readonly reply: Reply }
  | { readonly kind: 'in-flight' }
  | { readonly kind: 'mismatch' };

/** 키가 처음이면 시작, 본문이 다르면 422, 처리 중이면 409, 끝났으면 저장한 응답을 그대로 */
export function decideIdempotent(record: IdemRecord | undefined, hash: string): Decision {
  if (record === undefined) return { kind: 'start' };
  if (record.hash !== hash) return { kind: 'mismatch' };
  if (record.state === 'in-progress') return { kind: 'in-flight' };
  return { kind: 'replay', reply: record.reply };
}

export interface WebhookBook {
  readonly seen: readonly string[];
  readonly notified: number;
  readonly duplicatesProcessed: number;
}

export type Delivery = 'processed' | 'duplicate-processed' | 'skipped';

export const EMPTY_BOOK: WebhookBook = { seen: [], notified: 0, duplicatesProcessed: 0 };

export function receiveWebhook(
  book: WebhookBook,
  eventId: string,
  dedupe: boolean,
): { readonly book: WebhookBook; readonly delivery: Delivery } {
  if (!book.seen.includes(eventId)) {
    return {
      book: {
        seen: [...book.seen, eventId],
        notified: book.notified + 1,
        duplicatesProcessed: book.duplicatesProcessed,
      },
      delivery: 'processed',
    };
  }
  if (dedupe) return { book, delivery: 'skipped' };
  return {
    book: { seen: book.seen, notified: book.notified + 1, duplicatesProcessed: book.duplicatesProcessed + 1 },
    delivery: 'duplicate-processed',
  };
}

/** 실패 알림이 늦게 와도 이미 PAID 인 주문을 되돌리지 않아요 */
export function nextOrderStatus(current: OrderStatus, event: WebhookEventType): OrderStatus {
  if (event === 'payment.succeeded') return 'PAID';
  return current === 'PAID' ? 'PAID' : 'FAILED';
}

type TaskBody =
  | { readonly kind: 'send'; readonly why: Why }
  | { readonly kind: 'arrive'; readonly id: number; readonly amount: number }
  | { readonly kind: 'poll-arrive'; readonly id: number }
  | { readonly kind: 'poll-send' }
  | { readonly kind: 'charged'; readonly id: number; readonly amount: number }
  | { readonly kind: 'reply-arrive'; readonly id: number; readonly reply: Reply; readonly poll: boolean }
  | { readonly kind: 'timeout'; readonly id: number; readonly poll: boolean }
  | { readonly kind: 'webhook'; readonly eventId: string };

type Task = TaskBody & { readonly at: number; readonly seq: number };

const WHY_TEXT: Record<Why, string> = {
  first: '결제 버튼을 눌렀어요.',
  'double-click': '같은 버튼을 한 번 더 눌렀어요.',
  retry: '응답이 없어서 자동으로 다시 보내요.',
};

export function simulate(config: Config): Result {
  const rng = mulberry32(config.seed);
  const useKey = config.protection !== 'none';
  const events: SimEvent[] = [];
  const queue: Task[] = [];
  let seq = 0;
  let nextId = 1;

  let orderStatus = 'CREATED' as OrderStatus;
  let charges = 0;
  const chargedAmounts: number[] = [];
  const idem = new Map<string, IdemRecord>();
  let book: WebhookBook = EMPTY_BOOK;
  let clientView: ClientView = 'unknown';
  let timedOut = false;
  let finished = false;
  let resubmits = 0;
  let polls = 0;
  let sends = 0;
  const answered = new Set<number>();

  const log = (t: number, lane: Lane, text: string) => events.push({ t, lane, text });
  const schedule = (at: number, body: TaskBody) => queue.push({ ...body, at, seq: seq++ });

  const finish = (t: number, view: ClientView, text: string) => {
    finished = true;
    clientView = view;
    log(t, 'client', text);
  };

  const replyTo = (t: number, id: number, reply: Reply, poll: boolean) => {
    if (rng() * 100 < config.lossPercent) {
      log(t, 'network', '응답이 네트워크에서 사라졌어요. 클라이언트는 받지 못해요.');
      return;
    }
    schedule(t + LEG, { kind: 'reply-arrive', id, reply, poll });
  };

  const send = (t: number, why: Why) => {
    sends += 1;
    const id = nextId++;
    const amount = why === 'retry' && config.retryChangesBody ? COUPON_PRICE : PRICE;
    const keyText = useKey ? `키 ${IDEM_KEY}` : '키 없이';
    log(t, 'client', `${WHY_TEXT[why]} (${keyText}, ${amount.toLocaleString('ko-KR')}원)`);
    schedule(t + LEG, { kind: 'arrive', id, amount });
    schedule(t + TIMEOUT_TICKS, { kind: 'timeout', id, poll: false });
  };

  const sendPoll = (t: number) => {
    if (finished) return;
    if (polls >= MAX_POLLS) {
      log(t, 'client', '조회 한도에 닿았어요. 확인 중 화면을 유지해요.');
      return;
    }
    polls += 1;
    const id = nextId++;
    log(t, 'client', '주문 상태를 조회해요. 결제는 다시 보내지 않아요.');
    schedule(t + LEG, { kind: 'poll-arrive', id });
    schedule(t + TIMEOUT_TICKS, { kind: 'timeout', id, poll: true });
  };

  const startCharge = (t: number, id: number, amount: number) => {
    orderStatus = 'PAYMENT_PENDING';
    log(t, 'server', '카드사에 승인을 요청했어요.');
    schedule(t + CHARGE_TICKS, { kind: 'charged', id, amount });
  };

  const onArrive = (t: number, id: number, amount: number) => {
    if (!useKey) {
      log(t, 'server', '키가 없어서 기록을 보지 않아요. 바로 승인을 요청해요.');
      startCharge(t, id, amount);
      return;
    }
    const hash = fingerprint(amount);
    const decision = decideIdempotent(idem.get(IDEM_KEY), hash);
    if (decision.kind === 'start') {
      idem.set(IDEM_KEY, { hash, state: 'in-progress' });
      log(t, 'server', `키 ${IDEM_KEY} 를 처음 봤어요. 처리 중으로 기록해요.`);
      startCharge(t, id, amount);
    } else if (decision.kind === 'replay') {
      log(
        t,
        'server',
        `키와 본문이 같아요. 저장해 둔 응답(${decision.reply.code})을 돌려줘요. 카드사는 다시 부르지 않아요.`,
      );
      replyTo(t, id, decision.reply, false);
    } else if (decision.kind === 'in-flight') {
      log(t, 'server', '같은 키의 요청이 아직 처리 중이에요. 409 를 돌려줘요.');
      replyTo(t, id, { code: 409, order: orderStatus }, false);
    } else {
      log(t, 'server', '같은 키인데 금액이 달라요. 422 를 돌려주고 승인하지 않아요.');
      replyTo(t, id, { code: 422, order: orderStatus }, false);
    }
  };

  const onCharged = (t: number, id: number, amount: number) => {
    charges += 1;
    chargedAmounts.push(amount);
    orderStatus = 'PAID';
    const reply: Reply = { code: 200, order: 'PAID' };
    log(t, 'provider', `카드사 승인이 끝났어요. ${charges}번째 승인, ${amount.toLocaleString('ko-KR')}원.`);
    if (useKey) idem.set(IDEM_KEY, { hash: fingerprint(amount), state: 'done', reply });
    replyTo(t, id, reply, false);
    schedule(t + LEG, { kind: 'webhook', eventId: `evt_${charges}` });
    if (config.webhookDuplicates) schedule(t + LEG + 1, { kind: 'webhook', eventId: `evt_${charges}` });
  };

  const onWebhook = (t: number, eventId: string) => {
    const next = receiveWebhook(book, eventId, config.protection === 'key-webhook');
    book = next.book;
    orderStatus = nextOrderStatus(orderStatus, 'payment.succeeded');
    const text: Record<Delivery, string> = {
      processed: `${eventId} 를 처리해서 결제 완료 알림을 보냈어요.`,
      'duplicate-processed': `${eventId} 가 또 왔어요. 이미 처리한 이벤트인데 알림을 또 보냈어요.`,
      skipped: `${eventId} 는 이미 처리한 이벤트예요. 건너뛰었어요.`,
    };
    log(t, 'webhook', text[next.delivery]);
  };

  const onReply = (t: number, id: number, reply: Reply, poll: boolean) => {
    answered.add(id);
    if (finished) return;
    if (poll) {
      if (reply.order === 'PAID') {
        finish(t, 'confirmed', '조회 결과가 결제 완료예요. 완료 화면을 보여 줘요.');
      } else {
        log(t, 'client', '아직 결제 확인 중이에요. 잠시 뒤 다시 조회해요.');
        schedule(t + POLL_INTERVAL, { kind: 'poll-send' });
      }
      return;
    }
    if (reply.code === 200) {
      finish(t, 'confirmed', '결제 완료 응답을 받았어요. 완료 화면을 보여 줘요.');
    } else if (reply.code === 409) {
      log(t, 'client', '이미 처리 중이라는 응답(409)이에요. 같은 요청을 다시 보내지 않고 기다려요.');
    } else {
      finish(t, 'rejected', '결제 정보가 맞지 않는다는 응답(422)이에요. 실패로 보여 줘요.');
    }
  };

  const onTimeout = (t: number, id: number, poll: boolean) => {
    if (finished || answered.has(id)) return;
    if (!timedOut) {
      timedOut = true;
      log(t, 'client', '응답이 오지 않았어요. 결제 결과를 몰라요 (UNKNOWN).');
    }
    if (poll) {
      sendPoll(t);
      return;
    }
    if (config.timeoutPolicy === 'resubmit') {
      if (resubmits < MAX_RESUBMITS) {
        resubmits += 1;
        send(t, 'retry');
      } else {
        log(t, 'client', '재전송 한도에 닿았어요. 여기서 멈춰요.');
      }
    } else if (config.timeoutPolicy === 'poll' && polls === 0) {
      sendPoll(t);
    }
  };

  const handle = (task: Task) => {
    const t = task.at;
    switch (task.kind) {
      case 'send':
        return send(t, task.why);
      case 'arrive':
        return onArrive(t, task.id, task.amount);
      case 'poll-arrive':
        return replyTo(t, task.id, { code: 200, order: orderStatus }, true);
      case 'poll-send':
        return sendPoll(t);
      case 'charged':
        return onCharged(t, task.id, task.amount);
      case 'reply-arrive':
        return onReply(t, task.id, task.reply, task.poll);
      case 'timeout':
        return onTimeout(t, task.id, task.poll);
      case 'webhook':
        return onWebhook(t, task.eventId);
    }
  };

  schedule(0, { kind: 'send', why: 'first' });
  if (config.doubleClick) schedule(1, { kind: 'send', why: 'double-click' });

  while (queue.length > 0) {
    let pick = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[pick];
      if (a.at < b.at || (a.at === b.at && a.seq < b.seq)) pick = i;
    }
    const [task] = queue.splice(pick, 1);
    handle(task);
  }

  return {
    events,
    sends,
    providerCharges: charges,
    chargedAmounts,
    orderStatus,
    paidOrders: orderStatus === 'PAID' ? 1 : 0,
    notifications: book.notified,
    duplicateWebhooksProcessed: book.duplicatesProcessed,
    clientView,
  };
}

export interface Verdict {
  readonly tone: 'success' | 'warning' | 'error';
  readonly title: string;
}

export function verdictOf(result: Result): Verdict {
  if (result.providerCharges > 1) {
    return { tone: 'error', title: `같은 주문에 카드사 승인이 ${result.providerCharges}번 났어요. 중복 결제예요.` };
  }
  if (result.clientView === 'rejected' && result.providerCharges > 0) {
    return { tone: 'warning', title: '화면은 실패로 보였지만 카드사 승인은 끝났어요. 주문 상태를 조회해 맞춰야 해요.' };
  }
  if (result.clientView === 'unknown' && result.paidOrders === 1) {
    return { tone: 'warning', title: '서버는 결제를 완료했지만 고객 화면은 아직 확인 중이에요.' };
  }
  if (result.clientView === 'unknown') {
    return { tone: 'warning', title: '결제 결과를 확인하지 못했어요. 주문 상태 조회가 필요해요.' };
  }
  if (result.duplicateWebhooksProcessed > 0) {
    return {
      tone: 'warning',
      title: `같은 웹훅을 ${result.duplicateWebhooksProcessed}번 또 처리했어요. 알림이 여러 번 나갔어요.`,
    };
  }
  return { tone: 'success', title: '승인은 1번이고 화면도 결제 완료예요.' };
}
