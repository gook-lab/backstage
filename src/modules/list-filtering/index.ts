import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'list-filtering',
  track: 'cases',
  order: 48,
  title: '목록 필터와 정렬 — 조합마다 달라지는 조회 비용',
  question:
    '주문 목록에 필터를 여러 개 걸고 정렬을 바꾸면 응답이 몇 초씩 걸리는데, 서버는 필터 조합을 어떻게 처리할까요?',
  summary:
    '필터와 정렬이 겹치면 같은 화면도 DB가 읽는 행 수가 크게 달라져요. 복합 인덱스의 열 순서, 정렬을 인덱스가 대신하는 조건, 전체 개수를 세는 비용을 차례로 봐요. 필터 상태를 URL에 두는 FE 쪽 설계까지 다뤄요.',
  minutes: 20,
  tags: ['DB', '인덱스', '정렬', 'COUNT', 'URL'],
  checklist: [
    {
      id: 'column-order',
      text: '등호 조건 열을 앞에, 범위와 정렬 열을 뒤에 둔 복합 인덱스가 스캔 범위를 줄인다는 것을 설명할 수 있어요.',
    },
    {
      id: 'order-by-limit',
      text: 'LIMIT과 정렬 키가 인덱스 순서와 맞으면 정렬 단계 없이 앞의 몇 건만 읽는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'low-selectivity',
      text: '조건에 맞는 행이 드문 필터는 정렬 인덱스를 따라 읽을 때 많은 항목을 훑게 만든다는 것을 설명할 수 있어요.',
    },
    {
      id: 'exact-count-cost',
      text: '정확한 COUNT가 조건에 맞는 행을 세야 하는 이유를 알고, 상한 표시나 다음 페이지 여부로 바꿀 수 있는 화면을 골라낼 수 있어요.',
    },
    {
      id: 'allowlist',
      text: '정렬 키와 필터 키를 허용 목록으로 제한해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'url-state',
      text: '필터와 정렬 상태를 URL 쿼리에 두면 새로고침과 공유 링크가 같은 목록을 받는다는 것을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 다중 열 인덱스 (등호 · 범위 조건과 스캔 범위)',
      url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html',
    },
    {
      title: 'PostgreSQL 문서 — 인덱스와 ORDER BY (정렬 단계 · LIMIT · 역방향 스캔)',
      url: 'https://www.postgresql.org/docs/current/indexes-ordering.html',
    },
    {
      title: 'PostgreSQL 문서 — 부분 인덱스 (술어 함의 조건)',
      url: 'https://www.postgresql.org/docs/current/indexes-partial.html',
    },
    {
      title: 'PostgreSQL 문서 — EXPLAIN 사용법 (Rows Removed by Filter)',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
    },
    {
      title: 'PostgreSQL 문서 — 플래너 통계 (WHERE 조건의 선택도)',
      url: 'https://www.postgresql.org/docs/current/planner-stats.html',
    },
    {
      title: 'PostgreSQL 위키 — Count estimate (count(*)의 MVCC 비용과 추정 방법)',
      url: 'https://wiki.postgresql.org/wiki/Count_estimate',
    },
    {
      title: 'Stripe API 문서 — 검색 결과 페이지 (total_count는 10,000까지만 정확)',
      url: 'https://docs.stripe.com/api/pagination/search',
    },
    {
      title: 'MDN — URLSearchParams (URL 쿼리 문자열 다루기)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
