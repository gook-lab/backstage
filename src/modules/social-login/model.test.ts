import { describe, expect, it } from 'vitest';
import { ATTACK_IDS, FLOW_IDS, simulateLogin, type Attack, type Flow } from './model';

const outcomeOf = (flow: Flow, attack: Attack) => simulateLogin(flow, attack).outcome;

describe('정상 로그인', () => {
  it('모든 흐름에서 로그인이 끝나요', () => {
    for (const flow of FLOW_IDS) {
      expect(outcomeOf(flow, 'normal')).toBe('login');
    }
  });
});

describe('가로챈 code 또는 토큰 사용', () => {
  it('PKCE가 있으면 공격자의 교환 요청이 막혀요', () => {
    expect(outcomeOf('pkce', 'stolen')).toBe('blocked');
    expect(simulateLogin('pkce', 'stolen').blockedBy).toBe('PKCE code_verifier 검사');
  });

  it('PKCE가 없으면 가로챈 code만으로 토큰을 받아요', () => {
    expect(outcomeOf('no-pkce', 'stolen')).toBe('compromised');
  });

  it('state는 가로챈 code를 막지 못해요. state 없음 흐름도 PKCE 때문에 막혀요', () => {
    expect(outcomeOf('no-state', 'stolen')).toBe('blocked');
    expect(outcomeOf('no-pkce', 'stolen')).toBe('compromised');
  });

  it('implicit은 토큰을 교환하는 단계가 없어서 가로챈 토큰을 그대로 써요', () => {
    expect(outcomeOf('implicit', 'stolen')).toBe('compromised');
  });
});

describe('위조된 콜백', () => {
  it('state가 있으면 콜백 단계에서 막혀요', () => {
    expect(simulateLogin('pkce', 'forged').blockedBy).toBe('state 검사');
    expect(simulateLogin('no-pkce', 'forged').blockedBy).toBe('state 검사');
    expect(simulateLogin('implicit', 'forged').blockedBy).toBe('state 검사');
  });

  it('state가 없어도 PKCE가 있으면 교환 단계에서 막혀요', () => {
    expect(outcomeOf('no-state', 'forged')).toBe('blocked');
    expect(simulateLogin('no-state', 'forged').blockedBy).toBe('PKCE code_verifier 검사');
  });

  it('모든 흐름에서 공격이 통과하지 않아요', () => {
    for (const flow of FLOW_IDS) {
      expect(outcomeOf(flow, 'forged')).toBe('blocked');
    }
  });
});

describe('토큰이 URL 에 남음', () => {
  it('implicit은 URL에 남은 토큰이 그대로 쓰여요', () => {
    expect(outcomeOf('implicit', 'url')).toBe('compromised');
  });

  it('인가 코드 흐름에서는 PKCE가 있으면 URL에 남은 code를 막아요', () => {
    expect(outcomeOf('pkce', 'url')).toBe('blocked');
    expect(outcomeOf('no-pkce', 'url')).toBe('compromised');
  });
});

describe('단계 기록', () => {
  it('막힌 흐름은 마지막 단계가 차단이에요', () => {
    const result = simulateLogin('pkce', 'stolen');
    expect(result.steps.at(-1)?.status).toBe('blocked');
  });

  it('모든 시나리오는 적어도 한 단계를 남겨요', () => {
    for (const flow of FLOW_IDS) {
      for (const attack of ATTACK_IDS) {
        expect(simulateLogin(flow, attack).steps.length).toBeGreaterThan(0);
      }
    }
  });
});
