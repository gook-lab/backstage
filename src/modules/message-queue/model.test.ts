import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  PRESETS,
  VISIBILITY_TICKS,
  retryWait,
  simulate,
  verdictOf,
  type Config,
  type Result,
} from './model';

const run = (patch: Partial<Config>): Result => simulate({ ...DEFAULT_CONFIG, ...patch });

describe('at-least-once — ack 가 유실되면 같은 메시지가 다시 보여요', () => {
  it('멱등 처리를 끄면 같은 메시지에 포인트가 두 번 이상 지급돼요', () => {
    const result = run({ ackLossPercent: 50, maxReceives: 5 });
    expect(result.doubleGranted).toBeGreaterThan(0);
    expect(result.grants).toBeGreaterThan(result.acked);
    expect(verdictOf(result).tone).toBe('error');
  });

  it('멱등 처리를 켜면 재전송은 같아도 포인트는 메시지당 한 번만 지급돼요', () => {
    const plain = run({ ackLossPercent: 50, maxReceives: 5 });
    const idem = run({ ackLossPercent: 50, maxReceives: 5, idempotent: true });
    expect(idem.receives).toBe(plain.receives);
    expect(idem.doubleGranted).toBe(0);
    expect(idem.grants).toBe(idem.acked);
    expect(verdictOf(idem).tone).toBe('success');
  });
});

describe('재시도 — 처리 실패는 포인트를 지급하지 않아요', () => {
  it('실패가 40%여도 재시도 한도 안에서 모두 한 번씩 처리하고, 실패한 시도에는 지급하지 않아요', () => {
    const result = run({ failPercent: 40, maxReceives: 5, backoff: 'exponential' });
    expect(result.receives).toBeGreaterThan(DEFAULT_CONFIG.messages);
    expect(result.dead).toBe(0);
    expect(result.acked).toBe(DEFAULT_CONFIG.messages);
    expect(result.grants).toBe(result.acked);
    expect(result.doubleGranted).toBe(0);
  });

  it('실패가 항상 일어나면 재시도 한도만큼 받은 뒤 모두 DLQ 로 가요', () => {
    const result = run({ failPercent: 100, maxReceives: 3, backoff: 'exponential' });
    expect(result.receives).toBe(DEFAULT_CONFIG.messages * 3);
    expect(result.dead).toBe(DEFAULT_CONFIG.messages);
    expect(result.acked).toBe(0);
    expect(result.grants).toBe(0);
    expect(verdictOf(result).tone).toBe('warning');
  });
});

describe('DLQ — 처리 실패만 모이는 곳이 아니에요', () => {
  it('ack 가 계속 유실되어 한도에 닿으면 포인트가 이미 지급된 메시지도 DLQ 로 가요', () => {
    const result = run({ messages: 3, ackLossPercent: 100, maxReceives: 1, idempotent: true });
    expect(result.dead).toBe(3);
    expect(result.deadButGranted).toBe(3);
    expect(result.grants).toBe(3);
    expect(verdictOf(result).title).toContain('포인트가 이미 지급됐어요');
  });
});

describe('재시도 간격 — 가시성 시간과 지수 백오프', () => {
  it('백오프가 없으면 가시성 시간만큼 기다려요', () => {
    expect(retryWait(1, 'none', () => 0.5)).toBe(VISIBILITY_TICKS);
    expect(retryWait(4, 'none', () => 0.99)).toBe(VISIBILITY_TICKS);
  });

  it('지수 백오프는 시도가 늘수록 기다리는 상한이 커지고, 상한(8)을 넘지 않아요', () => {
    expect(retryWait(1, 'exponential', () => 0)).toBe(VISIBILITY_TICKS);
    expect(retryWait(3, 'exponential', () => 0.999)).toBe(VISIBILITY_TICKS + 8);
    expect(retryWait(10, 'exponential', () => 0.999)).toBe(VISIBILITY_TICKS + 8);
  });
});

describe('결정적 시드', () => {
  it('같은 설정과 같은 시드는 언제나 같은 결과를 내요', () => {
    const config = PRESETS[2].config;
    expect(simulate(config)).toEqual(simulate(config));
  });
});
