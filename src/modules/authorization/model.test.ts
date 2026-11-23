import { describe, expect, it } from 'vitest';
import {
  type Action,
  decide,
  DEFAULT_SCENARIO,
  type Owner,
  ownerOrgOf,
  PRESETS,
  type Role,
  type Scenario,
  type Strategy,
} from './model';

const ROLES: readonly Role[] = ['member', 'admin'];
const OWNERS: readonly Owner[] = ['self', 'colleague', 'outsider'];
const ACTIONS: readonly Action[] = ['read', 'update', 'export'];
const STRATEGIES: readonly Strategy[] = ['ui-only', 'role-only', 'role-and-owner'];

function everyScenario(): Scenario[] {
  const out: Scenario[] = [];
  for (const role of ROLES)
    for (const owner of OWNERS)
      for (const action of ACTIONS)
        for (const strategy of STRATEGIES)
          for (const hide404 of [false, true])
            for (const org of ['A', 'B'] as const)
              out.push({ ...DEFAULT_SCENARIO, role, owner, action, strategy, hide404, org });
  return out;
}

describe('예시 판단', () => {
  it.each(PRESETS.map((p) => [p.label, p] as const))('%s 는 기대한 응답이 나와요', (_, preset) => {
    const outcome = decide(preset.scenario);
    expect(outcome.status).toBe(preset.expected);
    expect(outcome.exposed).toBe(preset.exposed);
  });
});

describe('인증과 인가의 순서', () => {
  it('로그인하지 않은 요청은 어떤 전략에서도 401로 막히고 주문 내용이 나가지 않아요', () => {
    for (const s of everyScenario()) {
      const anonymous = { ...s, authenticated: false };
      const outcome = decide(anonymous);
      expect(outcome.status).toBe(401);
      expect(outcome.exposed).toBe(false);
    }
  });
});

describe('화면 숨김만 쓰는 전략', () => {
  it('버튼이 없어도 다른 사람의 주문을 조회하면 200이 나와요', () => {
    const outcome = decide({ ...DEFAULT_SCENARIO, strategy: 'ui-only', owner: 'outsider', action: 'read' });
    expect(outcome).toMatchObject({ status: 200, exposed: true });
  });

  it('로그인만 되어 있으면 모든 요청이 통과해요', () => {
    for (const s of everyScenario().filter((x) => x.strategy === 'ui-only' && x.authenticated)) {
      expect(decide(s)).toMatchObject({ status: 200, exposed: true });
    }
  });
});

describe('역할 검사만 하는 전략', () => {
  it('회원 역할이어도 남의 주문 id를 바꾸면 주문 내용이 나가요 (객체 수준 인가 누락)', () => {
    const outcome = decide({
      ...DEFAULT_SCENARIO,
      role: 'member',
      owner: 'colleague',
      action: 'read',
      strategy: 'role-only',
    });
    expect(outcome).toMatchObject({ status: 200, exposed: true });
  });

  it('관리자 역할은 다른 조직의 주문까지 내보내요', () => {
    const outcome = decide({
      ...DEFAULT_SCENARIO,
      role: 'admin',
      owner: 'outsider',
      action: 'export',
      strategy: 'role-only',
    });
    expect(outcome).toMatchObject({ status: 200, exposed: true });
  });

  it('회원이 내보내기를 누르면 역할 검사에서 403으로 막혀요', () => {
    const outcome = decide({ ...DEFAULT_SCENARIO, role: 'member', action: 'export', strategy: 'role-only' });
    expect(outcome).toMatchObject({ status: 403, exposed: false, denial: 'role' });
  });
});

describe('역할과 소유자를 함께 검사하는 전략', () => {
  it('주문 주인이면 통과하고, 같은 조직 관리자도 통과해요', () => {
    const base = { ...DEFAULT_SCENARIO, strategy: 'role-and-owner' as const, action: 'read' as const };
    expect(decide({ ...base, role: 'member', owner: 'self' })).toMatchObject({ status: 200, exposed: true });
    expect(decide({ ...base, role: 'admin', owner: 'colleague' })).toMatchObject({ status: 200, exposed: true });
  });

  it('동료 주문을 회원이 보면 403으로 막혀요', () => {
    const outcome = decide({ ...DEFAULT_SCENARIO, owner: 'colleague', strategy: 'role-and-owner' });
    expect(outcome).toMatchObject({ status: 403, exposed: false, denial: 'object' });
  });

  it('404로 숨기기를 켜면 객체 단위 실패만 404가 되고, 역할 실패는 403으로 남아요', () => {
    const object = decide({ ...DEFAULT_SCENARIO, owner: 'colleague', hide404: true });
    expect(object).toMatchObject({ status: 404, exposed: false, denial: 'object' });

    const role = decide({ ...DEFAULT_SCENARIO, action: 'export', role: 'member', hide404: true });
    expect(role).toMatchObject({ status: 403, denial: 'role' });
  });

  it('다른 조직 관리자는 같은 역할이어도 다른 조직 주문을 내보내지 못해요', () => {
    const outcome = decide({
      ...DEFAULT_SCENARIO,
      role: 'admin',
      owner: 'outsider',
      action: 'export',
      strategy: 'role-and-owner',
    });
    expect(outcome).toMatchObject({ status: 403, exposed: false, denial: 'object' });
  });

  it('통과하지 못한 요청에서는 주문 내용이 나가지 않아요', () => {
    const denied = everyScenario()
      .filter((x) => x.strategy === 'role-and-owner')
      .map(decide)
      .filter((o) => o.status !== 200);
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.every((o) => !o.exposed)).toBe(true);
  });

  it('주문 내용은 주인이거나 같은 조직 관리자일 때만 나가요', () => {
    const exposedCases = everyScenario().filter(
      (x) => x.strategy === 'role-and-owner' && x.authenticated && decide(x).exposed,
    );
    expect(exposedCases.length).toBeGreaterThan(0);
    for (const s of exposedCases) {
      const sameOrg = ownerOrgOf(s) === s.org;
      const allowed =
        s.action === 'export' ? s.role === 'admin' && sameOrg : s.owner === 'self' || (s.role === 'admin' && sameOrg);
      expect(allowed).toBe(true);
    }
  });

  it('숨기기 설정은 통과하는 요청의 응답을 바꾸지 않아요', () => {
    const passing = everyScenario().filter(
      (x) => x.strategy === 'role-and-owner' && !x.hide404 && decide(x).status === 200,
    );
    expect(passing.length).toBeGreaterThan(0);
    for (const s of passing) expect(decide({ ...s, hide404: true }).status).toBe(200);
  });
});

describe('전략별 노출 범위', () => {
  it('세 전략 중 역할과 소유자를 함께 검사하는 전략만 남의 주문 조회를 막아요', () => {
    const readColleagueAsMember = (strategy: Strategy) =>
      decide({ ...DEFAULT_SCENARIO, role: 'member', owner: 'colleague', action: 'read', strategy }).exposed;

    expect(readColleagueAsMember('ui-only')).toBe(true);
    expect(readColleagueAsMember('role-only')).toBe(true);
    expect(readColleagueAsMember('role-and-owner')).toBe(false);
  });
});
