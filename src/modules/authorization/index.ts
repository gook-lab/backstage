import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'authorization',
  track: 'cases',
  order: 34,
  title: '인가 · 객체 수준 권한',
  question: '관리자 메뉴는 화면에서 숨겼는데, URL의 id만 바꾸면 남의 주문이 보여요. 권한은 어디서 막아야 하나요?',
  summary:
    '인증은 누구인지 확인하고, 인가는 그 사람이 이 대상에 이 동작을 해도 되는지 확인해요. 화면 숨김은 보안이 아니라서 서버가 주문마다 주인을 따로 확인해야 해요. 역할 검사만 하면 생기는 일, 실패 응답을 401 · 403 · 404 중 무엇으로 줄지, 목록 API의 테넌트 조건을 시뮬레이터로 비교해요.',
  minutes: 22,
  tags: ['API 설계', '보안', '권한', '멀티 테넌트'],
  checklist: [
    {
      id: 'authn-vs-authz',
      text: '인증(누구인지)과 인가(무엇을 할 수 있는지)를 구분해서 설명할 수 있어요.',
    },
    {
      id: 'ui-is-not-security',
      text: '화면에서 버튼을 숨기는 것이 보안이 아닌 이유를 말할 수 있어요.',
    },
    {
      id: 'object-check',
      text: 'ID로 대상을 고르는 API마다 주인 또는 조직을 확인해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'status-choice',
      text: '권한 실패를 403으로 답할지 404로 숨길지 상황에 맞게 고를 수 있어요.',
    },
    {
      id: 'tenant-filter',
      text: '목록 API에 테넌트 조건을 서버에서 넣어야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'permission-flags',
      text: '서버가 내려준 권한 정보로 버튼을 그리되, 실제 판단은 서버에 맡긴다고 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP API Security Top 10 2023 — API1 Broken Object Level Authorization',
      url: 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
    },
    {
      title: 'OWASP API Security Top 10 2023 — API5 Broken Function Level Authorization',
      url: 'https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/',
    },
    {
      title: 'OWASP Authorization Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
    },
    {
      title: 'OWASP Multi-Tenant Security Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (15.5.2 401, 15.5.4 403, 15.5.5 404)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'NIST — Role Based Access Control (RBAC)',
      url: 'https://csrc.nist.gov/projects/role-based-access-control',
    },
    {
      title: 'NIST — Attribute Based Access Control (ABAC)',
      url: 'https://csrc.nist.gov/projects/attribute-based-access-control',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
