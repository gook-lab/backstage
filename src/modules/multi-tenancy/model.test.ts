import { moduleById } from '..';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, evaluate, type Guard, type Isolation, type Scenario } from './model';

const ISOLATIONS: readonly Isolation[] = ['pool', 'schema', 'database'];
const GUARDS: readonly Guard[] = ['manual', 'query-layer', 'rls'];

const run = (patch: Partial<Scenario>) => evaluate({ ...DEFAULT_SCENARIO, ...patch });

function allScenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const isolation of ISOLATIONS)
    for (const guard of GUARDS)
      for (const tenantLimit of [false, true])
        for (const cacheKeyHasTenant of [false, true])
          out.push({ isolation, guard, incident: 'none', tenantLimit, cacheKeyHasTenant });
  return out;
}

describe('사고 없는 기준선', () => {
  it('기본값은 다른 회사 데이터가 보이지 않아요', () => {
    expect(run({}).leaked).toBe(false);
  });

  it('사고가 없으면 어떤 격리 모델과 방어 장치를 골라도 노출되지 않아요', () => {
    for (const s of allScenarios()) {
      expect(evaluate(s).leaked).toBe(false);
    }
  });
});

describe('조건 빠진 쿼리', () => {
  it('테이블 공유에서 조건을 직접 쓰면 다른 회사 행이 섞이고, 모든 회사가 영향을 받아요', () => {
    expect(run({ incident: 'missing-filter', isolation: 'pool', guard: 'manual' })).toMatchObject({
      leaked: true,
      impact: 'all-tenants',
    });
  });

  it.each(['query-layer', 'rls'] as const)('테이블 공유에서 %s 방식은 빠진 조건이 노출로 이어지지 않아요', (guard) => {
    expect(run({ incident: 'missing-filter', isolation: 'pool', guard }).leaked).toBe(false);
  });

  it.each(['schema', 'database'] as const)(
    '%s 모델에서는 빠진 조건이 다른 회사 데이터를 가져오지 않아요',
    (isolation) => {
      const outcome = run({ incident: 'missing-filter', isolation, guard: 'manual' });
      expect(outcome.leaked).toBe(false);
      expect(outcome.impact).toBe('one-tenant');
    },
  );
});

describe('위조된 tenant id', () => {
  it.each(ISOLATIONS)('%s 모델에서 요청 값을 그대로 쓰면 다른 회사 데이터가 나와요', (isolation) => {
    expect(run({ incident: 'forged-tenant', isolation, guard: 'manual' })).toMatchObject({
      leaked: true,
      impact: 'all-tenants',
    });
  });

  it('검증된 로그인 정보에서 테넌트를 가져오는 방식은 모든 격리 모델에서 막혀요', () => {
    for (const isolation of ISOLATIONS) {
      for (const guard of ['query-layer', 'rls'] as const) {
        expect(run({ incident: 'forged-tenant', isolation, guard }).leaked).toBe(false);
      }
    }
  });
});

describe('캐시 응답 재사용', () => {
  it('캐시 키에 회사 식별자가 없으면 격리 모델과 방어 장치와 관계없이 새요', () => {
    for (const isolation of ISOLATIONS) {
      for (const guard of GUARDS) {
        expect(
          run({ incident: 'cache-reuse', isolation, guard, cacheKeyHasTenant: false }).leaked,
          `${isolation} · ${guard}`,
        ).toBe(true);
      }
    }
  });

  it('캐시 키에 회사 식별자를 넣으면 노출되지 않아요', () => {
    expect(run({ incident: 'cache-reuse', cacheKeyHasTenant: true }).leaked).toBe(false);
  });
});

describe('큰 회사에 요청 몰림', () => {
  it('데이터는 어떤 조합에서도 섞이지 않아요', () => {
    for (const s of allScenarios()) {
      expect(evaluate({ ...s, incident: 'big-tenant' }).leaked).toBe(false);
    }
  });

  it('회사별 DB는 영향이 그 회사 하나에 머물러요', () => {
    expect(run({ incident: 'big-tenant', isolation: 'database' }).impact).toBe('one-tenant');
  });

  it('테이블 공유와 스키마는 한도가 없으면 모든 회사가 느려져요', () => {
    expect(run({ incident: 'big-tenant', isolation: 'pool', tenantLimit: false }).impact).toBe('all-tenants');
    expect(run({ incident: 'big-tenant', isolation: 'schema', tenantLimit: false }).impact).toBe('all-tenants');
  });

  it('테넌트별 한도를 걸면 영향이 제한에 걸린 회사 하나로 줄어요', () => {
    expect(run({ incident: 'big-tenant', isolation: 'pool', tenantLimit: true }).impact).toBe('one-tenant');
  });
});

describe('글과 연결', () => {
  it('본문이 이어 읽도록 안내하는 모듈은 이름표가 있어요', () => {
    const ids = ['authorization', 'rate-limiting', 'http-caching', 'list-filtering'];
    expect(ids.filter((id) => moduleById(id) === undefined)).toEqual([]);
  });
});
