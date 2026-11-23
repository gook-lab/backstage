import { describe, expect, it } from 'vitest';
import {
  BACKOFF_CAP,
  DEFAULT_CONFIG,
  DOWN_UNTIL,
  MAX_ATTEMPTS,
  TIMEOUT_TICKS,
  attemptOf,
  backoffWait,
  mulberry32,
  simulate,
  verdictOf,
  type Config,
  type Result,
} from './model';

const run = (patch: Partial<Config>): Result => simulate({ ...DEFAULT_CONFIG, ...patch });

describe('발송 쪽 — 엔드포인트 상태에 따른 한 번의 시도', () => {
  it('2xx 만 성공으로 보고, 500 · 시간 초과 · 연결 실패는 실패로 봐요', () => {
    expect(attemptOf('healthy', 0).ok).toBe(true);
    expect(attemptOf('failing', 0).ok).toBe(false);
    expect(attemptOf('slow', 0).ok).toBe(false);
    expect(attemptOf('down', 0).ok).toBe(false);
    expect(attemptOf('down', DOWN_UNTIL).ok).toBe(true);
  });

  it('재시도 대기는 1틱 이상이고 상한을 넘지 않아요', () => {
    const rng = mulberry32(1);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      for (let i = 0; i < 50; i++) {
        const wait = backoffWait(attempt, rng);
        expect(wait).toBeGreaterThanOrEqual(1);
        expect(wait).toBeLessThanOrEqual(BACKOFF_CAP);
      }
    }
  });
});

describe('동기 발송 · 큐 발송 — 재시도가 있는지에 따라 결과가 갈려요', () => {
  it('정상 엔드포인트는 어느 방식에서도 이벤트 전부를 한 번에 성공시켜요', () => {
    for (const mode of ['sync', 'queue', 'isolated', 'auto-disable'] as const) {
      const result = run({ endpoint: 'healthy', mode });
      expect(result.delivered).toBe(DEFAULT_CONFIG.events * 2);
      expect(result.gaveUp).toBe(0);
      expect(verdictOf({ ...DEFAULT_CONFIG, mode }, result).tone).toBe('success');
    }
  });

  it('동기 발송은 500 을 받으면 재시도 없이 실패로 남아요', () => {
    const result = run({ endpoint: 'failing', mode: 'sync' });
    expect(result.attempts).toBe(DEFAULT_CONFIG.events * 2);
    expect(result.gaveUp).toBe(DEFAULT_CONFIG.events);
    expect(verdictOf({ ...DEFAULT_CONFIG, mode: 'sync' }, result).tone).toBe('error');
  });

  it('큐 발송은 500 이 이어져도 한도까지 다시 보내고 나서 포기해요', () => {
    const result = run({ endpoint: 'failing', mode: 'queue' });
    expect(result.attempts).toBeGreaterThan(DEFAULT_CONFIG.events * 2);
    expect(result.gaveUp).toBe(DEFAULT_CONFIG.events);
  });

  it('잠깐 다운된 엔드포인트는 큐 발송이 복구 뒤에 전부 전달해요', () => {
    const result = run({ endpoint: 'down', mode: 'queue' });
    expect(result.gaveUp).toBe(0);
    expect(result.delivered).toBe(DEFAULT_CONFIG.events * 2);
  });
});

describe('고객 격리 — 느린 고객이 다른 고객 발송을 막는지', () => {
  it('격리가 없으면 느린 엔드포인트 뒤에서 고객 B 의 발송이 밀려요', () => {
    const result = run({ endpoint: 'slow', mode: 'queue' });
    expect(result.otherDelay).toBeGreaterThan(1);
    expect(verdictOf({ ...DEFAULT_CONFIG, endpoint: 'slow', mode: 'queue' }, result).title).toMatch(/워커를 막았어요/);
  });

  it('엔드포인트별 격리를 켜면 고객 B 는 생성된 틱에 바로 나가요', () => {
    const result = run({ endpoint: 'slow', mode: 'isolated' });
    expect(result.otherDelay).toBe(1);
    expect(result.gaveUp).toBe(DEFAULT_CONFIG.events);
  });

  it('격리 모드는 같은 고객의 시도를 동시에 하나만 보내요', () => {
    const result = run({ endpoint: 'slow', mode: 'isolated' });
    const starts = result.log
      .filter((line) => line.customer === 'A' && line.text.includes('시도 시작'))
      .map((line) => line.t);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(TIMEOUT_TICKS);
  });
});

describe('자동 비활성화 — 연속 실패가 쌓이면 멈추고 알려요', () => {
  it('500 이 반복되면 엔드포인트를 멈추고 보류한 이벤트를 남겨요', () => {
    const queue = run({ endpoint: 'failing', mode: 'queue' });
    const auto = run({ endpoint: 'failing', mode: 'auto-disable' });
    expect(auto.disabled).toBe(true);
    expect(auto.attempts).toBeLessThan(queue.attempts);
    expect(auto.held).toBeGreaterThan(0);
    expect(verdictOf({ ...DEFAULT_CONFIG, endpoint: 'failing', mode: 'auto-disable' }, auto).tone).toBe('warning');
  });

  it('정상 엔드포인트에서는 멈추지 않아요', () => {
    const result = run({ endpoint: 'healthy', mode: 'auto-disable' });
    expect(result.disabled).toBe(false);
    expect(result.held).toBe(0);
  });
});

describe('시뮬레이션 — 같은 설정이면 같은 결과가 나와요', () => {
  it('설정이 같으면 로그와 틱 수가 항상 같아요', () => {
    const config: Config = { endpoint: 'slow', mode: 'isolated', events: 6 };
    expect(simulate(config)).toEqual(simulate(config));
  });
});
