import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'api-composition',
  track: 'cases',
  order: 27,
  title: '화면 단위 API — BFF와 GraphQL',
  question: '상품 상세 화면 하나에 API를 여러 번 불러요. 서버에 이 화면용 API 하나를 만들어 달라고 해도 될까요?',
  summary:
    '화면 하나가 API를 여러 번 부르면 왕복 지연이 쌓이고, 받은 데이터의 상당 부분을 쓰지 않게 돼요. 화면 단위로 응답을 묶는 BFF와 필요한 필드만 고르는 GraphQL이 각각 무엇을 줄이고 서버에 무엇을 옮기는지 정리해요.',
  minutes: 20,
  tags: ['API', 'BFF', 'GraphQL', '오버페칭', '워터폴'],
  checklist: [
    {
      id: 'overfetch-underfetch',
      text: '리소스 단위 응답이 화면보다 많거나 적은 데이터를 줄 때 오버페칭과 언더페칭을 구분할 수 있어요.',
    },
    {
      id: 'waterfall-math',
      text: '순차 의존 호출은 왕복 지연을 더하고, 독립 호출은 같이 보낼 수 있다는 것을 계산할 수 있어요.',
    },
    {
      id: 'bff-moves-round-trips',
      text: 'BFF가 클라이언트 왕복을 한 번으로 줄여도 서버 안의 호출 수는 그대로라는 것을 설명할 수 있어요.',
    },
    {
      id: 'graphql-http-cache',
      text: 'GraphQL이 필요한 필드만 한 번에 받는 방식과, 단일 엔드포인트가 HTTP 캐시와 어긋나는 이유를 설명할 수 있어요.',
    },
    {
      id: 'dataloader-batch',
      text: '서버 쪽 N+1을 DataLoader 같은 배치로 묶어야 한다는 것을 알아요.',
    },
    {
      id: 'partial-errors',
      text: '응답의 data와 errors를 함께 읽어, 부분 실패한 필드만 화면에서 비워 둘 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Sam Newman — Backends For Frontends',
      url: 'https://samnewman.io/patterns/architectural/bff/',
    },
    {
      title: 'Microsoft Azure Architecture Center — Backends for Frontends 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends',
    },
    {
      title: 'GraphQL 공식 문서 — Serving over HTTP (GET · POST · 상태 코드)',
      url: 'https://graphql.org/learn/serving-over-http/',
    },
    {
      title: 'GraphQL 공식 문서 — Performance (N+1 · GET 캐시 · 요청 제한)',
      url: 'https://graphql.org/learn/performance/',
    },
    {
      title: 'GraphQL 명세 (October 2021) — 실행 · 필드 오류 · 부분 응답',
      url: 'https://spec.graphql.org/October2021/',
    },
    {
      title: 'DataLoader README — 배치와 요청 단위 캐시',
      url: 'https://github.com/graphql/dataloader',
    },
    {
      title: 'MDN — Promise.all()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
