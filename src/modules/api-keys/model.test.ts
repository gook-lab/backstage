import { describe, expect, it } from 'vitest';
import {
  DAILY_REQUESTS,
  DEFAULT_CONFIG,
  type Config,
  type Event,
  PRESETS,
  effectiveDisplay,
  reasons,
  simulate,
} from './model';

const EVENTS: Event[] = ['db-leak', 'log-leak', 'rotation-old', 'revoked-use'];

const safe: Config = { storage: 'hash', transport: 'header', display: 'once', overlap: 'week' };

describe('저장 방식 — 해시는 DB 유출에도 키를 주지 않아요', () => {
  it('해시로 저장하면 DB 유출로 쓸 수 있는 키가 없어요', () => {
    expect(simulate(safe, 'db-leak').attackerKeys).toBe(0);
  });

  it('평문으로 저장하면 DB 유출로 살아 있는 키 값을 모두 얻어요', () => {
    expect(simulate({ ...safe, storage: 'plain' }, 'db-leak').attackerKeys).toBe(2);
    expect(simulate({ ...safe, storage: 'plain', overlap: 'none' }, 'db-leak').attackerKeys).toBe(1);
  });
});

describe('전달 방식 — URL 쿼리에 실린 키는 로그에 남아요', () => {
  it('URL 쿼리로 보내면 로그 유출로 키를 얻어요', () => {
    expect(simulate({ ...safe, transport: 'query' }, 'log-leak').attackerKeys).toBe(2);
  });

  it('헤더로 보내면 로그 유출로 얻는 키가 없어요', () => {
    expect(simulate(safe, 'log-leak').attackerKeys).toBe(0);
  });

  it('URL 쿼리일 때 이유 문장에 접근 로그를 말해요', () => {
    expect(reasons({ ...safe, transport: 'query' }, 'log-leak')).toContain('URL 쿼리에 실린 키는 접근 로그에 남아요.');
  });
});

describe('표시 방식 — 다시 보기는 평문일 때만 가능해요', () => {
  it('평문에서 다시 보기를 고르면 계정 화면에서 키를 다시 볼 수 있어요', () => {
    expect(simulate({ ...safe, storage: 'plain', display: 'reveal' }, 'db-leak').revealable).toBe(1);
  });

  it('해시로 저장하면 다시 보기를 골라도 한 번만 보여 줘요', () => {
    const config = { ...safe, storage: 'hash' as const, display: 'reveal' as const };
    expect(effectiveDisplay(config)).toBe('once');
    expect(simulate(config, 'db-leak').revealable).toBe(0);
    expect(reasons(config, 'db-leak')).toContain('해시로 저장해서 다시 보여 줄 수 없어요. 발급 때 한 번만 보여 줘요.');
  });
});

describe('회전 겹침 기간 — 옮기는 동안 정상 요청을 지켜요', () => {
  it('겹침이 없으면 옮기는 기간의 정상 요청이 모두 실패해요', () => {
    const outcome = simulate({ ...safe, overlap: 'none' }, 'rotation-old');
    expect(outcome.failingLegit).toBe(3 * DAILY_REQUESTS);
  });

  it('겹침이 옮기는 기간보다 길면 정상 요청이 실패하지 않아요', () => {
    for (const overlap of ['three', 'week', 'long'] as const) {
      expect(simulate({ ...safe, overlap }, 'rotation-old').failingLegit).toBe(0);
      expect(simulate({ ...safe, overlap }, 'revoked-use').failingLegit).toBe(0);
    }
  });

  it('옛 키가 살아 있는 동안은 옛 키 값도 통해요', () => {
    expect(simulate({ ...safe, overlap: 'week' }, 'rotation-old').attackerKeys).toBe(1);
    expect(simulate({ ...safe, overlap: 'none' }, 'rotation-old').attackerKeys).toBe(0);
  });

  it('폐기된 옛 키는 거부돼서 공격자가 쓸 수 없어요', () => {
    expect(simulate({ ...safe, storage: 'plain', overlap: 'long' }, 'revoked-use').attackerKeys).toBe(0);
  });

  it('겹침이 없을 때 이유 문장에 실패하는 날 수를 말해요', () => {
    expect(reasons({ ...safe, overlap: 'none' }, 'rotation-old')).toContain(
      '옮기는 3일 중 3일 동안 배치 요청이 실패해요.',
    );
  });
});

describe('권장 예시', () => {
  it('권장 예시는 어떤 사건에서도 공격자 키와 정상 실패가 없어요', () => {
    const recommended = PRESETS.find((p) => p.id === 'recommended');
    expect(recommended).toBeDefined();
    for (const event of EVENTS) {
      const outcome = simulate(recommended!.config, event);
      expect(outcome.attackerKeys).toBe(event === 'rotation-old' ? 1 : 0);
      expect(outcome.failingLegit).toBe(0);
    }
  });

  it('처음 화면은 잘못된 예이고 DB 유출로 키 두 개를 얻어요', () => {
    expect(DEFAULT_CONFIG).toEqual(PRESETS[0].config);
    expect(simulate(DEFAULT_CONFIG, 'db-leak').attackerKeys).toBe(2);
  });
});
