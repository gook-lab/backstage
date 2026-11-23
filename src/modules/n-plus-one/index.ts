import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'n-plus-one',
  track: 'basics',
  order: 2,
  title: 'N+1 쿼리와 인덱스',
  question: '목록 화면 하나 그리는데 왜 API가 느릴까요?',
  summary:
    '목록 하나에 쿼리가 수십 번 나가면 API는 금방 느려져요. 조회 방식과 인덱스가 쿼리 수와 읽는 행 수를 어떻게 바꾸는지 직접 돌려 봐요.',
  minutes: 14,
  tags: ['DB', '성능', 'ORM'],
  checklist: [
    {
      id: 'latency-grows-with-list',
      text: '응답 시간이 목록 길이에 비례해 늘면 N+1을 의심할 수 있어요.',
    },
    {
      id: 'count-queries',
      text: '목록 한 번 그릴 때 나가는 쿼리 수를 세고, 1 + N 인지 확인할 수 있어요.',
    },
    {
      id: 'pick-strategy',
      text: 'JOIN, IN 묶음, eager loading이 쿼리 수와 결과 행 수를 각각 어떻게 바꾸는지 설명할 수 있어요.',
    },
    {
      id: 'explain-scan',
      text: 'EXPLAIN에서 Seq Scan과 Index Scan을 구분하고, 버려지는 행이 많으면 인덱스를 의심할 수 있어요.',
    },
    {
      id: 'composite-order',
      text: '복합 인덱스는 조건이 붙는 열을 앞에 두어야 잘 쓰인다는 걸 알아요.',
    },
    {
      id: 'index-cost',
      text: '인덱스가 쓰기를 느리게 만든다는 점을 알고, 아무도 쓰지 않는 인덱스는 지울 수 있어요.',
    },
  ],
  sources: [
    { title: 'PostgreSQL 문서 — Chapter 11. Indexes', url: 'https://www.postgresql.org/docs/current/indexes.html' },
    { title: 'PostgreSQL 문서 — 11.2 Index Types', url: 'https://www.postgresql.org/docs/current/indexes-types.html' },
    {
      title: 'PostgreSQL 문서 — 11.3 Multicolumn Indexes',
      url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html',
    },
    {
      title: 'PostgreSQL 문서 — 14.1 Using EXPLAIN',
      url: 'https://www.postgresql.org/docs/current/using-explain.html',
    },
    {
      title: 'SQLAlchemy 문서 — Relationship Loading Techniques',
      url: 'https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html',
    },
    {
      title: 'Django 문서 — QuerySet select_related · prefetch_related',
      url: 'https://docs.djangoproject.com/en/6.1/ref/models/querysets/',
    },
    { title: 'DataLoader README (graphql/dataloader)', url: 'https://github.com/graphql/dataloader' },
    {
      title: 'MDN — Server-Timing 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing',
    },
    { title: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/' },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
