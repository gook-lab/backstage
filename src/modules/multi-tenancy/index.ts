import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'multi-tenancy',
  track: 'cases',
  order: 56,
  title: '멀티테넌시 · 회사별 데이터 격리',
  question: 'URL의 회사 id만 바꿨더니 다른 회사 데이터가 보였대요. 서버는 회사별 데이터를 어떻게 나누나요?',
  summary:
    '여러 회사가 한 서비스를 함께 쓸 때, 한 회사의 데이터가 다른 회사에 보이지 않게 하는 방법이에요. 테이블을 공유할지, 스키마나 DB를 나눌지 격리 모델을 고르고, 회사를 요청의 어느 값으로 정할지, 빠진 조건을 조회 계층과 RLS로 어떻게 막을지 정리해요. 시뮬레이터에서 사고 시나리오별 노출 여부와 영향 범위를 확인해요.',
  minutes: 24,
  tags: ['DB', '보안', '멀티 테넌트', '캐시'],
  checklist: [
    {
      id: 'isolation-models',
      text: '테이블 공유, 회사별 스키마, 회사별 DB의 격리 강도와 비용 차이를 설명할 수 있어요.',
    },
    {
      id: 'tenant-source',
      text: '회사 id를 요청 값이 아니라 검증된 로그인 정보에서 정해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'rls-default-deny',
      text: 'RLS를 켜고 정책이 없으면 행이 기본으로 보이지 않는다는 점을 설명할 수 있어요.',
    },
    {
      id: 'unique-with-tenant',
      text: '유일 제약에 tenant_id를 포함해야 하는 이유를 예시로 설명할 수 있어요.',
    },
    {
      id: 'tenant-limit',
      text: '한 회사가 자원을 독점할 때 테넌트별 한도로 다른 회사를 보호하는 방법을 설명할 수 있어요.',
    },
    {
      id: 'cache-key-tenant',
      text: '캐시 키에 회사 식별자가 빠지면 생기는 일을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 행 보안 정책 (Row Security Policies)',
      url: 'https://www.postgresql.org/docs/current/ddl-rowsecurity.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE POLICY',
      url: 'https://www.postgresql.org/docs/current/sql-createpolicy.html',
    },
    {
      title: 'PostgreSQL 문서 — 스키마 (Schemas)',
      url: 'https://www.postgresql.org/docs/current/ddl-schemas.html',
    },
    {
      title: 'PostgreSQL 문서 — 5.5. Constraints',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — 다중 열 인덱스 (Multicolumn Indexes)',
      url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html',
    },
    {
      title: 'OWASP Multi-Tenant Security Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html',
    },
    {
      title: 'AWS SaaS Architecture Fundamentals — Tenant isolation',
      url: 'https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html',
    },
    {
      title: 'AWS SaaS Architecture Fundamentals — Data partitioning',
      url: 'https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/data-partitioning.html',
    },
    {
      title: 'Azure 아키텍처 센터 — Tenancy Models for a Multitenant Solution',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models',
    },
    {
      title: 'Azure 아키텍처 센터 — Noisy Neighbor Antipattern',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/antipatterns/noisy-neighbor/noisy-neighbor',
    },
    {
      title: 'MDN — Vary 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
