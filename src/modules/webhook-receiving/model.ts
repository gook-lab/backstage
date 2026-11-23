export type Strategy = 'return-only' | 'webhook-only' | 'guard' | 'guard-recon';
export type OrderState = 'PENDING' | 'PAID' | 'CANCELED';

export interface Config {
  readonly strategy: Strategy;
  readonly payments: number;
  /** 브라우저 복귀 요청이 아예 오지 않는 비율 (창을 닫거나 네트워크가 끊김) */
  readonly returnLossPercent: number;
  /** 웹훅 한 건이 끝내 도착하지 않는 비율 */
  readonly webhookLossPercent: number;
  /** 웹훅 지연의 최댓값 (칸). 0 이면 승인 직후 바로 도착 */
  readonly webhookDelayMax: number;
  /** 도착한 웹훅이 같은 이벤트 ID 로 한 번 더 오는 비율 */
  readonly duplicatePercent: number;
  /** 환불 이벤트가 결제 완료 이벤트보다 먼저 도착하는 비율 */
  readonly reorderPercent: number;
  /** 대사(PG 조회) 주기 (칸). 0 이면 대사를 하지 않아요 */
  readonly reconEvery: number;
  readonly seed: number;
}

export interface LogLine {
  readonly t: number;
  readonly text: string;
  readonly tone: 'neutral' | 'ok' | 'warn';
}

export interface Result {
  readonly payments: number;
  readonly refunds: number;
  /** 마지막 칸에서 주문 상태가 실제 결제 상태와 다른 건수 */
  readonly wrong: number;
  /** 결제 완료 처리(부수 효과)가 두 번 이상 실행된 주문 수 */
  readonly doubleProcessed: number;
  /** 같은 이벤트 ID 라서 버린 웹훅 수 */
  readonly deduped: number;
  /** 상태 전이 검사에서 거절한 이벤트 수 */
  readonly rejected: number;
  /** 맞게 확정된 주문의 평균 확정 시간 (칸). 맞게 확정된 주문이 없으면 null */
  readonly avgConfirmTicks: number | null;
  readonly stillPending: number;
  readonly log: readonly LogLine[];
}

export interface Verdict {
  readonly tone: 'success' | 'warning' | 'error';
  readonly title: string;
}

export const HORIZON = 200;
export const REFUND_PERCENT = 20;
const APPROVE_DELAY = 2;
const PAYMENT_WINDOW = 21;
const REFUND_GAP_MIN = 12;
const REFUND_GAP_SPAN = 9;

type Kind = 'return' | 'succeeded' | 'refunded';

interface Delivery {
  readonly tick: number;
  readonly kind: Kind;
  readonly eventId: string | null;
  readonly payment: number;
}

interface Plan {
  readonly created: number;
  readonly approvedAt: number;
  readonly refundAt: number;
  readonly refunded: boolean;
  readonly deliveries: readonly Delivery[];
}

interface Track {
  status: OrderState;
  fulfilled: number;
  changedAt: number;
  readonly seen: Set<string>;
}

/** 시드가 같으면 항상 같은 결과가 나오는 작은 난수 생성기 (mulberry32) */
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

/** 주문마다 난수를 항상 같은 개수만큼 뽑는다. 확률 값만 바꾸면 같은 주문의 운명이 따라 바뀐다 */
function buildPlans(config: Config): Plan[] {
  const rand = mulberry32(config.seed);
  const roll = (percent: number) => rand() * 100 < percent;
  const span = config.webhookDelayMax + 1;
  const plans: Plan[] = [];

  for (let i = 0; i < config.payments; i++) {
    const created = Math.floor(rand() * PAYMENT_WINDOW);
    const refunded = roll(REFUND_PERCENT);
    const refundGap = REFUND_GAP_MIN + Math.floor(rand() * REFUND_GAP_SPAN);
    const succDelay = Math.floor(rand() * span);
    const refDelay = Math.floor(rand() * span);
    const returnLost = roll(config.returnLossPercent);
    const succLost = roll(config.webhookLossPercent);
    const refLost = roll(config.webhookLossPercent);
    const reorder = roll(config.reorderPercent);
    const dupSucc = roll(config.duplicatePercent);
    const dupRef = roll(config.duplicatePercent);
    const dupSuccDelay = Math.floor(rand() * span);
    const dupRefDelay = Math.floor(rand() * span);

    const approvedAt = created + APPROVE_DELAY;
    const refundAt = refunded ? approvedAt + refundGap : Number.POSITIVE_INFINITY;
    const deliveries: Delivery[] = [];

    if (!returnLost) {
      deliveries.push({ tick: approvedAt + 1, kind: 'return', eventId: null, payment: i });
    }

    const succId = `evt_${i}_succeeded`;
    const succTick = refunded && reorder ? refundAt + 1 + succDelay : approvedAt + succDelay;
    if (!succLost) {
      deliveries.push({ tick: succTick, kind: 'succeeded', eventId: succId, payment: i });
      if (dupSucc) {
        deliveries.push({ tick: succTick + 1 + dupSuccDelay, kind: 'succeeded', eventId: succId, payment: i });
      }
    }

    if (refunded && !refLost) {
      const refId = `evt_${i}_refunded`;
      const refTick = refundAt + refDelay;
      deliveries.push({ tick: refTick, kind: 'refunded', eventId: refId, payment: i });
      if (dupRef) {
        deliveries.push({ tick: refTick + 1 + dupRefDelay, kind: 'refunded', eventId: refId, payment: i });
      }
    }

    plans.push({ created, approvedAt, refundAt, refunded, deliveries });
  }
  return plans;
}

/** PG 가 그 칸에 알고 있는 결제 상태. 승인 전이면 null */
function pgStateAt(plan: Plan, t: number): OrderState | null {
  if (t < plan.approvedAt) return null;
  if (t >= plan.refundAt) return 'CANCELED';
  return 'PAID';
}

export function simulate(config: Config): Result {
  const plans = buildPlans(config);
  const buckets: Delivery[][] = Array.from({ length: HORIZON + 1 }, () => []);
  for (const plan of plans) {
    for (const d of plan.deliveries) {
      if (d.tick <= HORIZON) buckets[d.tick].push(d);
    }
  }

  const tracks: Track[] = plans.map((plan) => ({
    status: 'PENDING',
    fulfilled: 0,
    changedAt: plan.created,
    seen: new Set<string>(),
  }));
  const log: LogLine[] = [];
  let deduped = 0;
  let rejected = 0;

  const fulfill = (idx: number, t: number) => {
    tracks[idx].fulfilled++;
    tracks[idx].status = 'PAID';
    tracks[idx].changedAt = t;
  };

  const handleReturn = (d: Delivery) => {
    const track = tracks[d.payment];
    if (config.strategy !== 'return-only') {
      log.push({ t: d.tick, text: `#${d.payment + 1} 브라우저 복귀 도착 · 화면만 확인 중으로 둬요`, tone: 'neutral' });
      return;
    }
    if (track.status === 'PENDING') {
      fulfill(d.payment, d.tick);
      log.push({ t: d.tick, text: `#${d.payment + 1} 복귀 화면을 믿고 결제 완료 처리`, tone: 'ok' });
    }
  };

  const handleWebhookNaive = (d: Delivery) => {
    const track = tracks[d.payment];
    if (d.kind === 'succeeded') {
      track.fulfilled++;
      if (track.status !== 'PAID') track.changedAt = d.tick;
      track.status = 'PAID';
      log.push({ t: d.tick, text: `#${d.payment + 1} 웹훅 succeeded · 무조건 완료 처리`, tone: 'neutral' });
    } else {
      track.status = 'CANCELED';
      track.changedAt = d.tick;
      log.push({ t: d.tick, text: `#${d.payment + 1} 웹훅 refunded · 취소로 덮어씀`, tone: 'warn' });
    }
  };

  const handleWebhookGuarded = (d: Delivery) => {
    const track = tracks[d.payment];
    const id = d.eventId ?? '';
    if (track.seen.has(id)) {
      deduped++;
      log.push({ t: d.tick, text: `#${d.payment + 1} 같은 이벤트 ID 가 다시 왔어요 · 버림`, tone: 'neutral' });
      return;
    }
    track.seen.add(id);

    if (d.kind === 'succeeded' && track.status === 'PENDING') {
      fulfill(d.payment, d.tick);
      log.push({ t: d.tick, text: `#${d.payment + 1} succeeded · PENDING → PAID 로 전이`, tone: 'ok' });
    } else if (d.kind === 'refunded' && track.status === 'PAID') {
      track.status = 'CANCELED';
      track.changedAt = d.tick;
      log.push({ t: d.tick, text: `#${d.payment + 1} refunded · PAID → CANCELED 로 전이`, tone: 'ok' });
    } else {
      rejected++;
      log.push({
        t: d.tick,
        text: `#${d.payment + 1} ${d.kind} · 현재 ${track.status} 에서 전이 불가 · 거절`,
        tone: 'warn',
      });
    }
  };

  const reconcile = (t: number) => {
    plans.forEach((plan, idx) => {
      const track = tracks[idx];
      const pg = pgStateAt(plan, t);
      if (pg === 'PAID' && track.status === 'PENDING') {
        fulfill(idx, t);
        log.push({ t, text: `#${idx + 1} 대사: PG 조회는 승인됨 · 결제 완료 확정`, tone: 'ok' });
      } else if (pg === 'CANCELED' && track.status !== 'CANCELED') {
        track.status = 'CANCELED';
        track.changedAt = t;
        log.push({ t, text: `#${idx + 1} 대사: PG 조회는 취소됨 · 상태 맞춤`, tone: 'ok' });
      }
    });
  };

  for (let t = 0; t <= HORIZON; t++) {
    for (const d of buckets[t]) {
      if (d.kind === 'return') {
        handleReturn(d);
      } else if (config.strategy === 'webhook-only') {
        handleWebhookNaive(d);
      } else if (config.strategy === 'return-only') {
        log.push({
          t: d.tick,
          text: `#${d.payment + 1} 웹훅 ${d.kind} · 이 방식은 웹훅을 보지 않아요`,
          tone: 'neutral',
        });
      } else {
        handleWebhookGuarded(d);
      }
    }
    if (config.strategy === 'guard-recon' && config.reconEvery > 0 && t > 0 && t % config.reconEvery === 0) {
      reconcile(t);
    }
  }

  let wrong = 0;
  let doubleProcessed = 0;
  let stillPending = 0;
  let refunds = 0;
  let confirmSum = 0;
  let confirmCount = 0;

  plans.forEach((plan, idx) => {
    const track = tracks[idx];
    const truth: OrderState = plan.refunded ? 'CANCELED' : 'PAID';
    if (plan.refunded) refunds++;
    if (track.status === 'PENDING') stillPending++;
    if (track.fulfilled >= 2) doubleProcessed++;
    if (track.status !== truth) {
      wrong++;
    } else {
      confirmSum += track.changedAt - plan.created;
      confirmCount++;
    }
  });

  return {
    payments: plans.length,
    refunds,
    wrong,
    doubleProcessed,
    deduped,
    rejected,
    avgConfirmTicks: confirmCount === 0 ? null : confirmSum / confirmCount,
    stillPending,
    log,
  };
}

export function verdictOf(result: Result): Verdict {
  if (result.wrong > 0) {
    return { tone: 'error', title: `${result.wrong}건의 주문이 틀린 상태로 끝났어요.` };
  }
  if (result.doubleProcessed > 0) {
    return {
      tone: 'warning',
      title: `상태는 맞지만 ${result.doubleProcessed}건은 결제 완료 처리가 두 번 실행됐어요.`,
    };
  }
  return { tone: 'success', title: '모든 주문이 맞는 상태로 확정됐어요.' };
}
