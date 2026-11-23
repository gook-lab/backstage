/** 격리 모델: 테이블 공유 · 회사별 스키마 · 회사별 DB */
export type Isolation = 'pool' | 'schema' | 'database';

/** 쿼리에 테넌트 조건을 넣는 방법 */
export type Guard = 'manual' | 'query-layer' | 'rls';

/** 사고 시나리오. none 은 사고 없는 기준선이에요 */
export type Incident = 'none' | 'missing-filter' | 'forged-tenant' | 'cache-reuse' | 'big-tenant';

/** 영향 범위: 이 버그나 부하로 영향을 받는 회사의 범위 */
export type Impact = 'none' | 'one-tenant' | 'all-tenants';

export interface Scenario {
  isolation: Isolation;
  guard: Guard;
  incident: Incident;
  /** 테넌트별 한도. 큰 회사에 요청이 몰릴 때만 결과에 영향을 줘요 */
  tenantLimit: boolean;
  /** 캐시 키에 회사 식별자를 넣었는지. 캐시 응답 재사용에서만 결과에 영향을 줘요 */
  cacheKeyHasTenant: boolean;
}

export interface Outcome {
  /** 다른 회사 데이터가 응답에 보이는지 */
  leaked: boolean;
  impact: Impact;
  reason: string;
}

export const DEFAULT_SCENARIO: Scenario = {
  isolation: 'pool',
  guard: 'manual',
  incident: 'none',
  tenantLimit: false,
  cacheKeyHasTenant: true,
};

export const ISOLATION_LABEL: Record<Isolation, string> = {
  pool: '테이블 공유 · tenant_id 열',
  schema: '회사별 스키마',
  database: '회사별 DB',
};

export const GUARD_LABEL: Record<Guard, string> = {
  manual: '조건을 직접 쓰기',
  'query-layer': '조회 계층이 강제',
  rls: 'DB 행 보안 (RLS)',
};

export const INCIDENT_LABEL: Record<Incident, string> = {
  none: '사고 없음',
  'missing-filter': '조건 빠진 쿼리',
  'forged-tenant': '위조된 tenant id',
  'cache-reuse': '캐시 응답 재사용',
  'big-tenant': '큰 회사에 요청 몰림',
};

export const IMPACT_LABEL: Record<Impact, string> = {
  none: '영향 없음',
  'one-tenant': '한 회사에만 영향',
  'all-tenants': '모든 회사에 영향',
};

const leak = (impact: Impact, reason: string): Outcome => ({ leaked: true, impact, reason });
const safe = (impact: Impact, reason: string): Outcome => ({ leaked: false, impact, reason });

function missingFilter(s: Scenario): Outcome {
  if (s.isolation !== 'pool') {
    return safe(
      'one-tenant',
      `${ISOLATION_LABEL[s.isolation]}에서는 쿼리가 그 회사의 스키마나 DB 안에서만 돌아요. 빠진 조건은 같은 회사 안에서 행을 더 보여 줄 뿐이에요.`,
    );
  }
  if (s.guard === 'manual') {
    return leak(
      'all-tenants',
      '조건을 직접 쓴 쿼리에서 tenant 조건이 빠져서, 같은 테이블의 다른 회사 행이 응답에 섞여요.',
    );
  }
  if (s.guard === 'query-layer') {
    return safe(
      'none',
      '조회 계층이 모든 쿼리에 tenant 조건을 붙여요. 빠진 조건이 생기지 않아요. 계층을 거치지 않는 원시 SQL은 따로 막아야 해요.',
    );
  }
  return safe(
    'none',
    'DB 정책이 행을 거르므로 쿼리 조건이 빠져도 다른 회사 행은 보이지 않아요. 접속 역할이 BYPASSRLS거나 슈퍼유저면 정책을 건너뛰어요.',
  );
}

function forgedTenant(s: Scenario): Outcome {
  if (s.guard === 'manual') {
    if (s.isolation === 'pool') {
      return leak('all-tenants', '요청의 tenant id를 조건에 그대로 넣었어요. 바꿔 보낸 id의 회사 행이 나와요.');
    }
    return leak('all-tenants', '요청의 id로 스키마나 DB를 고르면, 바꿔 보낸 id의 회사 스키마나 DB가 열려요.');
  }
  return safe(
    'none',
    '검증된 로그인 정보에서 테넌트를 가져와요. 요청의 id는 무시되거나 대조되어서 다른 회사로 넘어가지 않아요.',
  );
}

function cacheReuse(s: Scenario): Outcome {
  if (!s.cacheKeyHasTenant) {
    return leak(
      'all-tenants',
      '캐시 키에 회사 식별자가 없어서, 한 회사가 채운 응답을 다른 회사가 받아요. DB를 어떻게 나눴는지와 관계없이 생겨요.',
    );
  }
  return safe(
    'none',
    '키마다 회사 식별자가 들어가서 응답이 회사별로 나뉘어요. 보호된 값은 캐시를 읽기 전에 권한을 확인해야 해요.',
  );
}

function bigTenant(s: Scenario): Outcome {
  if (s.isolation === 'database') {
    return safe(
      'one-tenant',
      '회사마다 DB가 따로라서 무거운 요청의 부하가 그 회사의 DB 안에서만 생겨요. 다른 회사 데이터는 섞이지 않아요.',
    );
  }
  if (s.tenantLimit) {
    return safe(
      'one-tenant',
      '테넌트별 한도가 큰 회사의 요청을 제한해요. 제한에 걸린 회사만 거절되고 다른 회사는 같은 자원을 계속 써요.',
    );
  }
  return safe(
    'all-tenants',
    '같은 DB 서버와 연결을 나눠 써요. 한 회사의 무거운 쿼리가 모든 회사의 응답을 늦춰요. 데이터는 섞이지 않아요.',
  );
}

export function evaluate(s: Scenario): Outcome {
  switch (s.incident) {
    case 'none':
      return safe('none', '지금 고른 사고가 없어요. 격리 모델과 방어 장치를 바꿔도 노출은 생기지 않아요.');
    case 'missing-filter':
      return missingFilter(s);
    case 'forged-tenant':
      return forgedTenant(s);
    case 'cache-reuse':
      return cacheReuse(s);
    case 'big-tenant':
      return bigTenant(s);
  }
}
