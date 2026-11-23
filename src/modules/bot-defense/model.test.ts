import { describe, expect, it } from 'vitest';
import { ATTACKS, DEFENSES, IP_LIMIT, type Defense, HORIZON, IP_WINDOW, type Params, simulate } from './model';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const base: Params = { attack: 'brute', defenses: [], attackRate: 20, seed: 7 };
const run = (p: Partial<Params> & { seed: number }) => simulate({ ...base, ...p });

describe('방어가 없을 때', () => {
  it('무차별 대입은 사전을 끝까지 돌려 정답을 맞혀요', () => {
    for (const seed of SEEDS) {
      expect(run({ seed, attack: 'brute' }).compromised).toBe(1);
    }
  });

  it('유출 쌍 스터핑은 쌍마다 한 번씩 시도하고, 맞는 쌍만 계정을 열어요', () => {
    for (const seed of SEEDS) {
      const r = run({ seed, attack: 'spread' });
      expect(r.attempts).toBe(250);
      expect(r.attackBlocked).toBe(0);
      expect(r.attackLeft).toBe(0);
    }
  });
});

describe('IP 기준 제한', () => {
  it('한 IP 에서 오는 무차별 대입은 창마다 상한을 넘지 못해요', () => {
    const windows = HORIZON / IP_WINDOW;
    for (const seed of SEEDS) {
      const r = run({ seed, attack: 'brute', defenses: ['ip'] });
      expect(r.attempts).toBeLessThanOrEqual(windows * IP_LIMIT);
    }
  });

  it('IP 1000개로 나눠 보내면 IP 제한이 한 번도 걸리지 않아요', () => {
    for (const seed of SEEDS) {
      const without = run({ seed, attack: 'spread' });
      const withIp = run({ seed, attack: 'spread', defenses: ['ip'] });
      expect(withIp.attackBlockedBy.ip).toBe(0);
      expect(withIp.compromised).toBe(without.compromised);
    }
  });
});

describe('계정 잠금', () => {
  it('피해자 계정이 잠기면 정상 로그인도 같이 막혀요', () => {
    const results = SEEDS.map((seed) => run({ seed, attack: 'brute', defenses: ['lockout'] }));
    const notOpened = results.filter((r) => r.compromised === 0);
    expect(notOpened.every((r) => r.lockedAccounts === 1)).toBe(true);
    expect(results.reduce((sum, r) => sum + r.legitBlockedBy.lock, 0)).toBeGreaterThan(0);
  });

  it('유출 쌍 스터핑은 계정마다 한두 번만 시도해서 잠금이 결과를 바꾸지 않아요', () => {
    for (const seed of SEEDS) {
      const without = run({ seed, attack: 'stuffing' });
      const withLock = run({ seed, attack: 'stuffing', defenses: ['lockout'] });
      expect(withLock.attackBlockedBy.lock).toBe(0);
      expect(withLock.compromised).toBe(without.compromised);
    }
  });
});

describe('전체 실패율 기준 캡차', () => {
  it('실패가 몰리는 스터핑에서는 캡차가 공격 시도를 걸러요', () => {
    for (const seed of SEEDS) {
      const r = run({ seed, attack: 'spread', defenses: ['global'] });
      expect(r.attackBlockedBy.captcha).toBeGreaterThan(0);
    }
  });
});

describe('MFA', () => {
  it.each(ATTACKS)('%s 공격은 MFA 가 켜져 있으면 계정을 하나도 열지 못해요', (attack) => {
    for (const seed of SEEDS) {
      expect(run({ seed, attack, defenses: ['mfa'] }).compromised).toBe(0);
    }
  });
});

describe('같은 입력', () => {
  it('같은 시드와 방어 조합이면 항상 같은 결과가 나와요', () => {
    const defenses: Defense[] = DEFENSES.filter((d) => d !== 'mfa');
    for (const attack of ATTACKS) {
      expect(run({ seed: 11, attack, defenses })).toEqual(run({ seed: 11, attack, defenses }));
    }
  });
});
