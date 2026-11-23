import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  EMPTY_BOOK,
  PRESETS,
  decideIdempotent,
  fingerprint,
  nextOrderStatus,
  receiveWebhook,
  simulate,
  verdictOf,
  type Config,
  type IdemRecord,
  type Result,
  type WebhookBook,
} from './model';

const run = (patch: Partial<Config>): Result => simulate({ ...DEFAULT_CONFIG, ...patch });

const logOf = (result: Result): string[] => result.events.map((e) => e.text);

describe('재시도 — 응답이 유실된 뒤 다시 보내기', () => {
  it('보호가 없으면 응답이 사라진 뒤 재전송이 승인을 한 번 더 불러서 승인이 2번 나요', () => {
    const result = run({ lossPercent: 100, timeoutPolicy: 'resubmit' });
    expect(result.sends).toBe(2);
    expect(result.providerCharges).toBe(2);
    expect(result.paidOrders).toBe(1);
    expect(result.clientView).toBe('unknown');
    expect(verdictOf(result).tone).toBe('error');
  });

  it('멱등성 키가 있으면 같은 키의 재전송은 저장된 응답을 받고 승인은 1번이에요', () => {
    const result = run({ lossPercent: 100, timeoutPolicy: 'resubmit', protection: 'key' });
    expect(result.sends).toBe(2);
    expect(result.providerCharges).toBe(1);
    expect(logOf(result).some((text) => text.includes('저장해 둔 응답'))).toBe(true);
  });

  it('같은 키에 다른 금액이 오면 422 를 돌려주고 두 번째 승인은 하지 않아요', () => {
    const result = run({
      lossPercent: 100,
      timeoutPolicy: 'resubmit',
      protection: 'key',
      retryChangesBody: true,
    });
    expect(result.providerCharges).toBe(1);
    expect(result.chargedAmounts).toEqual([10000]);
    expect(logOf(result).some((text) => text.includes('422'))).toBe(true);
  });

  it('상태 조회 정책은 응답이 없어도 결제를 다시 보내지 않아요', () => {
    const result = run({ lossPercent: 100, timeoutPolicy: 'poll', protection: 'key' });
    expect(result.providerCharges).toBe(1);
    expect(result.events.filter((e) => e.lane === 'client' && e.text.includes('결제는 다시 보내지'))).not.toHaveLength(
      0,
    );
    expect(result.clientView).toBe('unknown');
  });
});

describe('더블 클릭 — 같은 시도의 두 번째 요청', () => {
  it('보호가 없으면 두 요청이 모두 승인돼요', () => {
    const result = run({ doubleClick: true });
    expect(result.providerCharges).toBe(2);
    expect(result.paidOrders).toBe(1);
  });

  it('같은 키면 처리 중인 두 번째 요청은 409 를 받고 승인은 1번이에요', () => {
    const result = run({ doubleClick: true, protection: 'key' });
    expect(result.providerCharges).toBe(1);
    expect(logOf(result).some((text) => text.includes('처리 중'))).toBe(true);
    expect(result.clientView).toBe('confirmed');
  });
});

describe('웹훅 — 중복과 순서', () => {
  it('키만 있으면 같은 이벤트를 두 번째로 받은 웹훅도 처리해요', () => {
    const result = run({ protection: 'key', webhookDuplicates: true });
    expect(result.providerCharges).toBe(1);
    expect(result.duplicateWebhooksProcessed).toBe(1);
    expect(result.notifications).toBe(2);
  });

  it('이벤트 번호로 중복을 걸러내면 같은 웹훅은 한 번만 처리해요', () => {
    const result = run({ protection: 'key-webhook', webhookDuplicates: true });
    expect(result.duplicateWebhooksProcessed).toBe(0);
    expect(result.notifications).toBe(1);
  });

  it('순서가 뒤섞이고 중복된 이벤트도 번호별로 한 번씩만 처리해요', () => {
    const deliveries = ['evt_2', 'evt_1', 'evt_2', 'evt_1'];
    const final = deliveries.reduce<WebhookBook>((book, id) => receiveWebhook(book, id, true).book, EMPTY_BOOK);
    expect(final.notified).toBe(2);
    expect(final.duplicatesProcessed).toBe(0);
  });

  it('실패 알림이 늦게 와도 이미 결제 완료된 주문을 되돌리지 않아요', () => {
    expect(nextOrderStatus('PAID', 'payment.failed')).toBe('PAID');
    expect(nextOrderStatus('PAYMENT_PENDING', 'payment.failed')).toBe('FAILED');
  });
});

describe('멱등성 판단 — 키 기록 네 가지 경우', () => {
  const hash = fingerprint(10000);
  const done: IdemRecord = {
    hash,
    state: 'done',
    reply: { code: 200, order: 'PAID' },
  };

  it('처음 보는 키는 시작해요', () => {
    expect(decideIdempotent(undefined, hash)).toEqual({ kind: 'start' });
  });

  it('같은 키와 같은 본문이 처리 중이면 409 로 기다리게 해요', () => {
    expect(decideIdempotent({ hash, state: 'in-progress' }, hash)).toEqual({ kind: 'in-flight' });
  });

  it('같은 키인데 본문이 다르면 422 로 거절해요', () => {
    expect(decideIdempotent(done, fingerprint(9000))).toEqual({ kind: 'mismatch' });
  });

  it('끝난 요청은 저장해 둔 응답을 그대로 돌려줘요', () => {
    expect(decideIdempotent(done, hash)).toEqual({ kind: 'replay', reply: { code: 200, order: 'PAID' } });
  });
});

describe('시뮬레이션 결정성', () => {
  it.each(PRESETS.map((p) => [p.id, p.config] as const))('%s 는 같은 설정이면 항상 같은 결과가 나와요', (_, config) => {
    expect(simulate(config)).toEqual(simulate(config));
  });
});
