import { describe, expect, it } from 'vitest';
import { SUBSCRIPTIONS, judge, simulate, type Subscription } from './model';

const [laptop, phone, tablet, old] = SUBSCRIPTIONS as [Subscription, Subscription, Subscription, Subscription];

describe('구독별 전달 결과', () => {
  it('연결된 기기는 발송 시각에 바로 전달돼요', () => {
    expect(judge(laptop, { sendAt: 10, ttl: 5 })).toMatchObject({ outcome: 'delivered', at: 10 });
  });

  it('TTL 안에 켜지는 기기는 켜진 틱에 대기 후 전달돼요', () => {
    expect(judge(phone, { sendAt: 10, ttl: 5 })).toMatchObject({ outcome: 'delivered-after-wait', at: 12 });
  });

  it('TTL 이 지나기 전에 켜지지 않으면 TTL이 끝난 틱에 버려요', () => {
    expect(judge(phone, { sendAt: 10, ttl: 1 })).toMatchObject({ outcome: 'dropped', at: 11 });
    expect(judge(tablet, { sendAt: 10, ttl: 5 })).toMatchObject({ outcome: 'dropped', at: 15 });
  });

  it('TTL 이 0 이면 꺼진 기기는 그 자리에서 버려요', () => {
    expect(judge(phone, { sendAt: 10, ttl: 0 })).toMatchObject({ outcome: 'dropped', at: 10 });
  });

  it('TTL 이 0 이어도 연결된 기기에는 바로 전달돼요', () => {
    expect(judge(laptop, { sendAt: 10, ttl: 0 })).toMatchObject({ outcome: 'delivered', at: 10 });
  });

  it('발송 시각에 이미 켜져 있으면 TTL과 관계없이 바로 전달돼요', () => {
    expect(judge(phone, { sendAt: 15, ttl: 0 })).toMatchObject({ outcome: 'delivered', at: 15 });
  });

  it('만료된 구독은 TTL을 아무리 길게 둬도 삭제 대상이에요', () => {
    expect(judge(old, { sendAt: 10, ttl: 20 })).toEqual({ subscription: old, outcome: 'deleted', at: null });
  });
});

describe('구독 목록 전체 결과', () => {
  it.each([0, 1, 5, 20])('TTL %i 에서도 모든 구독이 정확히 한 번씩 분류돼요', (ttl) => {
    const r = simulate({ sendAt: 10, ttl });
    expect(r.verdicts).toHaveLength(SUBSCRIPTIONS.length);
    const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(SUBSCRIPTIONS.length);
  });

  it('기본값(발송 10, TTL 5)은 네 구독을 각각 다르게 분류해요', () => {
    const r = simulate({ sendAt: 10, ttl: 5 });
    expect(r.counts).toEqual({ delivered: 1, 'delivered-after-wait': 1, dropped: 1, deleted: 1 });
  });
});
