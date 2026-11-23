import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'content-moderation',
  track: 'cases',
  order: 84,
  title: '신고와 검수 — 중복 집계, 자동 숨김, 검수 대기열',
  question: '같은 댓글을 여러 명이 신고하면 어떻게 되고, 신고가 쌓이면 바로 숨겨야 할까요?',
  summary:
    '신고는 같은 사람이 여러 번 보내거나 여러 계정이 몰려서 쌓여요. 중복을 어떻게 세고, 자동 숨김 임계값을 어떻게 잡고, 검수 대기열을 두 사람이 나눠 처리하게 할지 정리해요.',
  minutes: 20,
  tags: ['DB', '동시성', '권한', '신고', '검수'],
  checklist: [
    {
      id: 'dedupe-report',
      text: '(신고자, 대상) 유니크 제약으로 같은 사람의 재신고를 한 번만 세고, 다시 신고해도 같은 결과를 돌려줄 수 있어요.',
    },
    {
      id: 'count-is-not-people',
      text: '자동 숨김 임계값이 실제 사람 수가 아니라 집계 수라서, 재시도나 조직적 신고로 쉽게 넘는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'state-visibility',
      text: '게시, 숨김(검수 중), 삭제, 복원 상태를 나누고, 작성자와 다른 사람에게 보이는 것이 다르다는 것을 말할 수 있어요.',
    },
    {
      id: 'skip-locked-queue',
      text: '고른 항목을 FOR UPDATE SKIP LOCKED로 잡아서 두 검수자가 같은 항목을 처리하지 않게 할 수 있어요.',
    },
    {
      id: 'reasons-and-appeal',
      text: '숨김이나 삭제 결정에 이유, 기록, 이의 제기 경로를 함께 남기는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-report-states',
      text: '"이미 신고했어요", "검수 중이에요"처럼 응답에 맞춘 상태를 화면에 보여 줄 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — SELECT 명령의 잠금 절 (FOR UPDATE, SKIP LOCKED)',
      url: 'https://www.postgresql.org/docs/current/sql-select.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (FOR UPDATE 행 수준 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 유니크 제약 (5.5.3)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — INSERT 명령의 ON CONFLICT DO NOTHING',
      url: 'https://www.postgresql.org/docs/current/sql-insert.html',
    },
    {
      title: 'Regulation (EU) 2022/2065 (DSA) — 제16조 통지 및 조치, 제17조 결정 이유 설명',
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2065',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
