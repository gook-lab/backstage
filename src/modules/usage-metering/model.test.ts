import { describe, expect, it } from 'vitest';
import { ATTRIBUTIONS, BOUNDARY, METHODS, type Params, SCENARIOS, clockLabel, simulate } from './model';

const base: Params = {
  method: 'events',
  scenario: 'burst',
  limit: 100,
  dedupe: true,
  attribution: 'occurred',
  tick: 33,
};

describe('사용 이벤트 집계와 한도', () => {
  it('1분 집계 방식은 집계 사이에 들어온 호출을 못 봐서 한도를 넘겨 허용해요', () => {
    const r = simulate({ ...base, method: 'events', scenario: 'burst' });
    expect(r.accepted).toBe(130);
    expect(r.overLimit).toBe(30);
  });

  it('요청마다 카운터는 한도에서 정확히 멈춰요', () => {
    const r = simulate({ ...base, method: 'counter', scenario: 'burst' });
    expect(r.accepted).toBe(100);
    expect(r.overLimit).toBe(0);
  });

  it('한도 근처에서 같은 순간 들어온 호출은 한꺼번에 통과해요', () => {
    const r = simulate({ ...base, method: 'events', scenario: 'near-limit' });
    expect(r.overLimit).toBe(15);
    expect(simulate({ ...base, method: 'counter', scenario: 'near-limit' }).overLimit).toBe(0);
  });

  it('화면 숫자는 마지막 집계 시각까지 도착한 이벤트만 세요', () => {
    const r = simulate({ ...base, method: 'events', tick: 33 });
    expect(r.snapTick).toBe(30);
    expect(r.screen).toBe(40);
    expect(r.actual).toBe(100);
  });

  it('요청마다 카운터는 화면과 실제 숫자가 같아요', () => {
    const r = simulate({ ...base, method: 'counter', tick: 33 });
    expect(r.snapTick).toBe(33);
    expect(r.screen).toBe(r.actual);
  });
});

describe('멱등성 키와 재전송 중복', () => {
  it('멱등성 키를 끄면 재전송된 이벤트가 두 번 세어져서 한도 안인데도 호출을 막아요', () => {
    const r = simulate({ ...base, scenario: 'retry', dedupe: false });
    expect(r.accepted).toBe(54);
    expect(r.falseBlocks).toBe(16);
    expect(r.billed[0] + r.billed[1]).toBe(108);
  });

  it('멱등성 키를 켜면 같은 호출은 한 번만 세고 한도도 맞아요', () => {
    const r = simulate({ ...base, scenario: 'retry', dedupe: true });
    expect(r.accepted).toBe(70);
    expect(r.falseBlocks).toBe(0);
    expect(r.billed[0] + r.billed[1]).toBe(70);
  });
});

describe('청구 기간 경계와 정정 항목', () => {
  it('발생 시각 기준이면 23:59 호출은 이번 달에 들고, 마감 뒤 도착한 건은 정정 항목으로 다음 달에 들어가요', () => {
    const r = simulate({ ...base, method: 'events', scenario: 'boundary', attribution: 'occurred', tick: 70 });
    expect(r.billed).toEqual([59, 31]);
    expect(r.corrections).toBe(1);
    expect(r.misplaced).toBe(1);
    expect(r.focusBilled).toBe(1);
  });

  it('도착 시각 기준이면 23:59 호출이 다음 달에 들어가서 여섯 건이 발생 달과 달라요', () => {
    const r = simulate({ ...base, method: 'events', scenario: 'boundary', attribution: 'arrived', tick: 70 });
    expect(r.billed).toEqual([54, 36]);
    expect(r.corrections).toBe(0);
    expect(r.misplaced).toBe(6);
    expect(r.focusBilled).toBe(2);
  });

  it('요청마다 카운터는 경계에서도 발생 시각 기준으로 나뉘고 정정이 없어요', () => {
    const r = simulate({ ...base, method: 'counter', scenario: 'boundary', tick: 70 });
    expect(r.billed).toEqual([BOUNDARY, 30]);
    expect(r.corrections).toBe(0);
    expect(r.misplaced).toBe(0);
  });
});

describe('불변 조건', () => {
  it('요청 경로 카운터를 쓰는 방식은 모든 시나리오와 한도에서 한도를 넘기지 않아요', () => {
    for (const method of ['counter', 'events-fast'] as const) {
      for (const scenario of SCENARIOS) {
        for (const limit of [20, 60, 100, 150]) {
          for (const dedupe of [true, false]) {
            for (const attribution of ATTRIBUTIONS) {
              const r = simulate({ method, scenario, limit, dedupe, attribution, tick: 40 });
              expect(r.overLimit).toBe(0);
              expect(r.falseBlocks).toBe(0);
              expect(r.accepted).toBeLessThanOrEqual(limit);
            }
          }
        }
      }
    }
  });

  it('멱등성 키를 켜면 모든 방식과 시나리오에서 청구 건수가 허용 호출 수와 같아요', () => {
    for (const method of METHODS) {
      for (const scenario of SCENARIOS) {
        const r = simulate({ ...base, method, scenario, dedupe: true, tick: 180 });
        expect(r.billed[0] + r.billed[1]).toBe(r.accepted);
      }
    }
  });

  it('틱을 시각으로 바꾸면 23:59:00 과 00:00:00 이 나와요', () => {
    expect(clockLabel(54)).toBe('23:59:00');
    expect(clockLabel(60)).toBe('00:00:00');
  });
});
