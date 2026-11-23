import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'pagination',
  order: 1,
  title: '페이지네이션 — offset · cursor',
  question: '목록 API 가 offset 이면 무엇을 조심해야 하나요?',
  summary:
    '목록을 나누는 방법은 두 가지예요. 번호로 자르면 서버가 건너뛴 행을 읽고, 마지막 글의 위치로 이으면 목록이 바뀌어도 같은 자리에서 이어 받아요.',
  minutes: 12,
  tags: ['API 설계', 'DB'],
  checklist: [
    {
      id: 'dup-miss',
      text: '무한 스크롤 목록에 offset 을 쓰면 중복 · 누락이 생기는 조건을 설명할 수 있다',
    },
    {
      id: 'deep-cost',
      text: 'offset 이 커질수록 DB 가 건너뛴 행을 읽고 버린다는 점으로 깊은 페이지가 느려지는 이유를 설명할 수 있다',
    },
    {
      id: 'tie-breaker',
      text: '정렬 키가 유일하지 않으면 커서가 같은 시각의 글을 건너뛸 수 있다는 것을 알고, id 같은 보조 키를 붙일 수 있다',
    },
    {
      id: 'keyset-index',
      text: '(created_at, id) 조건과 ORDER BY 를 같은 순서의 복합 인덱스에 맞출 수 있다',
    },
    {
      id: 'total-count',
      text: '목록 화면에 전체 개수가 꼭 필요한지 판단하고, COUNT(*) 비용을 피할 대안을 말할 수 있다',
    },
    {
      id: 'response-shape',
      text: '응답의 page · total 또는 nextCursor · hasMore 를 보고 어떤 방식인지 알아보고, BE 에 물을 질문을 고를 수 있다',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 7.6. LIMIT and OFFSET',
      url: 'https://www.postgresql.org/docs/current/queries-limit.html',
    },
    {
      title: 'PostgreSQL 문서 — 9.26. Row and Array Comparisons',
      url: 'https://www.postgresql.org/docs/current/functions-comparisons.html',
    },
    {
      title: 'Use The Index, Luke — OFFSET is bad for skipping previous rows',
      url: 'https://use-the-index-luke.com/sql/partial-results/fetch-next-page',
    },
    {
      title: 'Use The Index, Luke — We need tool support for keyset pagination',
      url: 'https://use-the-index-luke.com/no-offset',
    },
    {
      title: 'PostgreSQL wiki — Slow Counting',
      url: 'https://wiki.postgresql.org/wiki/Slow_Counting',
    },
    {
      title: 'Stripe API 문서 — Pagination',
      url: 'https://docs.stripe.com/api/pagination',
    },
    {
      title: 'Slack Web API 문서 — Pagination',
      url: 'https://docs.slack.dev/apis/web-api/pagination',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
