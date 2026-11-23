import { describe, expect, it } from 'vitest';
import { type Order, type Params, type Payload, type Strategy, simulate } from './model';

const run = (order: Order, payload: Payload, strategy: Strategy) => simulate({ order, payload, strategy });

describe('바뀐 필드만 보내는 편집', () => {
  it('노트북이 먼저 도착하면 폰의 본문 저장이 노트북 수정을 덮고, 응답은 모두 200이에요', () => {
    const r = run('laptop-first', 'patch', 'lww');
    expect(r.writes.map((w) => w.status)).toEqual([200, 200, 200]);
    expect(r.final).toEqual({ title: '주말 장보기', body: '우유, 계란' });
    expect(r.lost).toEqual([{ device: 'laptop', field: 'body', value: '우유, 두부' }]);
  });

  it('같은 필드를 두 기기가 고치면 병합으로도 한쪽 수정이 사라져요', () => {
    const r = run('laptop-first', 'patch', 'merge');
    expect(r.lost).toHaveLength(1);
    expect(r.final.body).toBe('우유, 계란');
  });

  it('사용자 선택으로 바꾸면 저장하지 않고 409로 보류해요. 잃은 변경은 없어요', () => {
    const r = run('laptop-first', 'patch', 'ask');
    expect(r.lost).toEqual([]);
    expect(r.pending).toEqual([{ device: 'phone', field: 'body', value: '우유, 계란' }]);
    expect(r.writes.at(-1)?.status).toBe(409);
    expect(r.final.body).toBe('우유, 두부');
    expect(r.phoneView.body).toBe('우유, 계란');
    expect(r.laptopView.body).toBe('우유, 두부');
  });
});

describe('문서 전체를 보내는 편집', () => {
  it('마지막 쓰기 우선이면 폰이 손대지 않은 제목까지 옛 값으로 돌아가요', () => {
    const r = run('phone-first', 'full', 'lww');
    expect(r.final.title).toBe('장보기');
    expect(r.lost.map((l) => l.field)).toEqual(['title', 'body']);
  });

  it('필드 단위 병합이면 손대지 않은 제목은 살리고, 같은 본문 충돌만 잃어요', () => {
    const r = run('phone-first', 'full', 'merge');
    expect(r.final).toEqual({ title: '주말 장보기', body: '우유, 두부' });
    expect(r.lost).toEqual([{ device: 'phone', field: 'body', value: '우유, 계란' }]);
  });

  it('사용자 선택이면 노트북의 본문 충돌만 보류하고 제목은 그대로 둬요', () => {
    const r = run('phone-first', 'full', 'ask');
    expect(r.final).toEqual({ title: '주말 장보기', body: '우유, 계란' });
    expect(r.pending).toEqual([{ device: 'laptop', field: 'body', value: '우유, 두부' }]);
    expect(r.lost).toEqual([]);
  });
});

describe('모든 조합의 기본 불변식', () => {
  const orders: Order[] = ['laptop-first', 'phone-first'];
  const payloads: Payload[] = ['patch', 'full'];
  const strategies: Strategy[] = ['lww', 'merge', 'ask'];

  it('응답 수는 편집 세 건과 같고, 409는 보류가 있을 때만 나와요', () => {
    for (const order of orders)
      for (const payload of payloads)
        for (const strategy of strategies) {
          const r = simulate({ order, payload, strategy } satisfies Params);
          expect(r.writes).toHaveLength(3);
          expect(r.writes.some((w) => w.status === 409)).toBe(r.pending.length > 0);
        }
  });

  it('마지막 쓰기 우선에서는 잃은 변경이 있어도 응답이 모두 200이에요', () => {
    for (const order of orders)
      for (const payload of payloads) {
        const r = run(order, payload, 'lww');
        expect(r.writes.every((w) => w.status === 200)).toBe(true);
        expect(r.lost.length).toBeGreaterThan(0);
      }
  });
});
