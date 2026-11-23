import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'leaderboard',
  track: 'cases',
  order: 65,
  title: '실시간 랭킹 — 내 순위와 상위 N명',
  question: '참가자가 100만 명인데 내 순위는 어떻게 빨리 계산하나요?',
  summary:
    '매번 점수보다 높은 행을 세면 참가자가 늘수록 느려져요. 정렬된 집합으로 점수 순서를 저장소에 두면 순위 조회가 로그 단계로 끝나요. 동점 규칙, 점수 커서 페이지, 일간 · 주간 키, 재구축까지 정리해요.',
  minutes: 16,
  tags: ['DB', 'Redis', '자료 구조', '페이지네이션'],
  checklist: [
    {
      id: 'count-cost',
      text: '점수보다 높은 행을 매번 세면 읽는 행이 참가자 수에 비례해 늘어난다는 것을 설명할 수 있어요.',
    },
    {
      id: 'sorted-set-ops',
      text: 'ZADD · ZINCRBY · ZREVRANK가 각각 로그 시간으로 점수 변경과 순위 조회를 처리한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'tie-rule',
      text: '같은 점수일 때 먼저 도달한 사람이 위에 오도록 도달 순서를 점수에 섞는 방법을 설계할 수 있어요.',
    },
    {
      id: 'score-cursor',
      text: '순위 목록을 오프셋 대신 (점수, 도달 순서) 커서로 이어 읽을 수 있어요.',
    },
    {
      id: 'period-keys',
      text: '일간 · 주간 랭킹을 키로 나누고 만료를 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'drift-rebuild',
      text: '원본 DB와 랭킹 저장소가 어긋났을 때 원본에서 다시 채우는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'server-score',
      text: '점수는 서버가 계산하고, 클라이언트가 보낸 점수 값을 믿으면 안 된다는 것을 알아요.',
    },
  ],
  sources: [
    {
      title: 'Redis 문서 — Sorted sets (점수 부동소수점, 같은 점수는 문자열 순서)',
      url: 'https://redis.io/docs/latest/develop/data-types/sorted-sets/',
    },
    {
      title: 'Redis 문서 — ZADD (Time complexity: O(log(N)) per item)',
      url: 'https://redis.io/docs/latest/commands/zadd/',
    },
    {
      title: 'Redis 문서 — ZINCRBY (Time complexity: O(log(N)))',
      url: 'https://redis.io/docs/latest/commands/zincrby/',
    },
    {
      title: 'Redis 문서 — ZREVRANK (높은 점수부터 0부터 세는 순위, O(log(N)))',
      url: 'https://redis.io/docs/latest/commands/zrevrank/',
    },
    {
      title: 'Redis 문서 — ZRANGE (O(log(N)+M), REV 인자)',
      url: 'https://redis.io/docs/latest/commands/zrange/',
    },
    {
      title: 'Redis 문서 — ZREVRANGE (6.2.0부터 deprecated, ZRANGE REV로 대체)',
      url: 'https://redis.io/docs/latest/commands/zrevrange/',
    },
    {
      title: 'PostgreSQL 문서 — 9.23 Window Functions (row_number · rank · dense_rank)',
      url: 'https://www.postgresql.org/docs/current/functions-window.html',
    },
    {
      title: 'PostgreSQL 문서 — 11.4 Indexes and ORDER BY (B-tree 정렬 · 역방향 스캔)',
      url: 'https://www.postgresql.org/docs/current/indexes-ordering.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
