import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'replication-lag',
  track: 'cases',
  order: 18,
  title: '복제 지연 — 방금 쓴 글이 안 보여요',
  question: '글을 저장하고 목록으로 돌아왔는데 방금 쓴 글이 없어요. 새로고침하면 보여요. 왜 그럴까요?',
  summary:
    '주 DB에 쓴 값이 읽기 복제본에 닿기까지 걸리는 시간을 다뤄요. 비동기 복제 지연, 동기 복제를 켤 때의 비용, 쓴 직후 자기 쓰기를 읽는 다섯 가지 방식, 새로고침 때 값이 뒤로 가는 단조 읽기 문제를 시뮬레이터로 비교해요.',
  minutes: 20,
  tags: ['복제', '일관성', 'DB', '캐시', 'FE'],
  checklist: [
    {
      id: 'async-window',
      text: '비동기 복제에서는 주 DB 커밋과 복제본 반영 사이에 간격이 생기고, 그 사이 읽기는 옛 값을 본다는 것을 설명할 수 있어요.',
    },
    {
      id: 'sync-cost',
      text: 'synchronous_commit 기본값이 on이고, remote_apply는 커밋이 복제본 반영까지 기다리게 해서 지연을 키운다는 것을 말할 수 있어요.',
    },
    {
      id: 'lsn-check',
      text: '쓰기 뒤 위치(LSN)를 받아 두고, 복제본이 그 위치까지 재생했을 때만 읽는 방식을 설명할 수 있어요.',
    },
    {
      id: 'routing-cost',
      text: '쓴 뒤 N초 주 DB 읽기와 응답 반영이 주 DB 부하와 한계를 어떻게 바꾸는지 비교할 수 있어요.',
    },
    {
      id: 'monotonic',
      text: '한 복제본의 재생 위치는 뒤로 가지 않으므로, 세션을 한 복제본에 고정하면 값이 뒤로 가지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-keep-pending',
      text: '쓰기 응답의 글을 목록에 넣고, 재조회 결과에 그 글이 나타날 때까지 임시 항목을 유지하는 FE 규칙을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 19 문서 — Streaming Replication, Hot Standby, 자기 쓰기 읽기(read-your-writes) 절',
      url: 'https://www.postgresql.org/docs/19/warm-standby.html',
    },
    {
      title: 'PostgreSQL 19 문서 — WAL 설정 (synchronous_commit 값과 remote_apply)',
      url: 'https://www.postgresql.org/docs/19/runtime-config-wal.html',
    },
    {
      title: 'PostgreSQL 19 문서 — 통계 뷰 (pg_stat_replication의 replay_lag)',
      url: 'https://www.postgresql.org/docs/19/monitoring-stats.html',
    },
    {
      title: 'PostgreSQL 19 문서 — 복구 제어 함수 (pg_last_wal_replay_lsn, pg_current_wal_insert_lsn)',
      url: 'https://www.postgresql.org/docs/19/functions-admin.html',
    },
    {
      title: 'PostgreSQL 19 문서 — WAIT 명령 (WAIT FOR LSN, MODE, TIMEOUT)',
      url: 'https://www.postgresql.org/docs/19/sql-wait.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (15.3.2 201 Created, Location 헤더)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
