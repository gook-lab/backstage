import { describe, expect, it } from 'vitest';
import { MAX_REQUESTS, PRESETS, type Options, simulate } from './model';

const SEEDS = Array.from({ length: 30 }, (_, k) => k + 1);

const base = (patch: Partial<Options>): Options => ({
  requests: 4,
  strategy: 'each',
  rotation: false,
  reuseDetection: false,
  seed: 1,
  ...patch,
});

describe('동시 401 갱신 시뮬레이션', () => {
  it('같은 옵션과 시드면 항상 같은 결과가 나와요', () => {
    const opts = base({ strategy: 'each', rotation: true, reuseDetection: true, seed: 42 });
    expect(simulate(opts)).toEqual(simulate(opts));
  });

  it('회전이 없으면 각자 갱신해도 모두 성공하고, 갱신 요청은 요청 수만큼 나가요', () => {
    for (const seed of SEEDS) {
      for (const requests of [1, 3, MAX_REQUESTS]) {
        const r = simulate(base({ requests, seed, strategy: 'each', rotation: false }));
        expect(r.refreshCalls).toBe(requests);
        expect(r.requestsOk).toBe(requests);
        expect(r.sessionEnded).toBe(false);
      }
    }
  });

  it('회전만 켠 각자 갱신은 새 토큰이 한 번만 나오고 나머지 요청은 실패해요', () => {
    for (const seed of SEEDS) {
      for (let requests = 2; requests <= MAX_REQUESTS; requests++) {
        const r = simulate(base({ requests, seed, strategy: 'each', rotation: true, reuseDetection: false }));
        expect(r.refreshOk).toBe(1);
        expect(r.staleTokens).toBe(requests - 1);
        expect(r.requestsOk).toBe(1);
        expect(r.requestsFailed).toBe(requests - 1);
        expect(r.sessionEnded).toBe(false);
      }
    }
  });

  it('회전과 재사용 감지를 켜면 요청이 둘 이상일 때 세션이 끊겨요', () => {
    for (const seed of SEEDS) {
      for (let requests = 2; requests <= MAX_REQUESTS; requests++) {
        const r = simulate(base({ requests, seed, strategy: 'each', rotation: true, reuseDetection: true }));
        expect(r.sessionEnded).toBe(true);
        expect(r.requestsFailed).toBeGreaterThanOrEqual(requests - 1);
      }
    }
  });

  it('요청이 하나뿐이면 재사용 감지가 켜져도 세션이 끊기지 않아요', () => {
    for (const seed of SEEDS) {
      const r = simulate(base({ requests: 1, seed, strategy: 'each', rotation: true, reuseDetection: true }));
      expect(r.sessionEnded).toBe(false);
      expect(r.requestsOk).toBe(1);
    }
  });

  it('갱신을 하나로 묶으면 갱신 요청은 한 번이고, 모든 요청이 새 토큰으로 성공해요', () => {
    for (const seed of SEEDS) {
      for (let requests = 1; requests <= MAX_REQUESTS; requests++) {
        const r = simulate(base({ requests, seed, strategy: 'shared', rotation: true, reuseDetection: true }));
        expect(r.refreshCalls).toBe(1);
        expect(r.refreshOk).toBe(1);
        expect(r.staleTokens).toBe(0);
        expect(r.requestsOk).toBe(requests);
        expect(r.sessionEnded).toBe(false);
      }
    }
  });

  it('성공과 실패를 합치면 원래 요청 수와 같아요', () => {
    for (const seed of SEEDS) {
      for (const p of PRESETS) {
        const r = simulate({ ...p.options, requests: MAX_REQUESTS, seed });
        expect(r.requestsOk + r.requestsFailed).toBe(MAX_REQUESTS);
      }
    }
  });

  it('로그는 시간 순서대로 남아요', () => {
    for (const seed of SEEDS) {
      const { log } = simulate(
        base({ requests: MAX_REQUESTS, seed, strategy: 'each', rotation: true, reuseDetection: true }),
      );
      const times = log.map((l) => l.t);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it('요청 수는 1 에서 8 사이로 맞춰져요', () => {
    expect(simulate(base({ requests: 0 })).refreshCalls).toBe(1);
    expect(simulate(base({ requests: 99, strategy: 'shared', rotation: true })).requestsOk).toBe(MAX_REQUESTS);
  });
});

describe('예시 옵션', () => {
  it('예시 id 는 겹치지 않아요', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
