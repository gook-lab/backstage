import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'soft-delete',
  track: 'cases',
  order: 57,
  title: '삭제와 회원 탈퇴 — 소프트 삭제 · 복구 기간 · 영구 삭제',
  question: '삭제 버튼을 누르면 데이터가 정말 지워지나요, 복구와 재가입은 어떻게 처리해야 할까요?',
  summary:
    '행을 지우는 하드 삭제와 deleted_at만 채우는 소프트 삭제를 비교해요. 소프트 삭제가 모든 조회에 조건을 요구하는 문제와, 부분 유일 인덱스로 재가입을 여는 방법을 봐요. 복구 기간 뒤 영구 삭제와 탈퇴 시 개인정보 파기까지 정리해요.',
  minutes: 20,
  tags: ['DB', '삭제', '개인정보', 'API 설계'],
  checklist: [
    {
      id: 'hard-vs-soft',
      text: '하드 삭제와 소프트 삭제의 차이를 설명하고, 복구 요구가 있을 때 어느 쪽을 고를지 말할 수 있어요.',
    },
    {
      id: 'filter-everywhere',
      text: '소프트 삭제 행이 모든 조회에서 빠져야 하는 이유와, 뷰로 그 조건을 한곳에 모으는 방법을 설명할 수 있어요.',
    },
    {
      id: 'partial-unique',
      text: '부분 유일 인덱스로 살아 있는 행끼리만 이메일을 유일하게 만들어, 탈퇴 후 재가입을 여는 방법을 설명할 수 있어요.',
    },
    {
      id: 'on-delete',
      text: '외래 키의 ON DELETE 동작을 관계의 성격으로 고르고, 소프트 삭제에서는 그 동작이 실행되지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'purge-batch',
      text: '복구 기간이 지난 행을 자식부터 지우는 영구 삭제 배치의 순서를 설명할 수 있어요.',
    },
    {
      id: 'withdrawal-retention',
      text: '탈퇴 시 개인정보를 파기하거나 익명화하고, 남겨야 하는 기록은 따로 정하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'delete-idempotent',
      text: 'DELETE를 반복했을 때 204와 404 중 어느 응답이 맞는지 RFC 9110 기준으로 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 11.8 Partial Indexes (부분 인덱스 · 부분 유일 인덱스 · 술어 함의)',
      url: 'https://www.postgresql.org/docs/current/indexes-partial.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE INDEX (UNIQUE · WHERE 술어 · NULLS DISTINCT)',
      url: 'https://www.postgresql.org/docs/current/sql-createindex.html',
    },
    {
      title: 'PostgreSQL 문서 — 5.5.5 Foreign Keys (ON DELETE 동작 · 참조 열 조건)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE VIEW (뷰는 물리적으로 저장되지 않음)',
      url: 'https://www.postgresql.org/docs/current/sql-createview.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (9.2.2 멱등 메서드, 9.3.5 DELETE, 15.3.5 204, 15.5.5 404 · 410)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'GDPR 제17조 — 삭제권 (잊힐 권리), 원문 미러',
      url: 'https://gdpr-info.eu/art-17-gdpr/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
