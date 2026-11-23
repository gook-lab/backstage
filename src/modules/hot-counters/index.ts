import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'hot-counters',
  track: 'cases',
  order: 6,
  title: '좋아요와 조회수 — 인기 글의 숫자가 바로 안 맞는 이유',
  question: '인기 글의 좋아요 수는 왜 바로 안 맞을까요?',
  summary:
    '좋아요는 사용자마다 한 번만 세고, 조회수는 근사해도 되는 이벤트로 다뤄요. 한 행에 몰리는 카운터 UPDATE가 왜 줄을 세우는지, 샤딩과 버퍼링이 무엇을 바꾸는지, 화면에 보이는 숫자가 왜 잠깐 늦는지 정리해요.',
  minutes: 20,
  tags: ['DB', '동시성', 'HTTP', '캐시', '카운터'],
  checklist: [
    {
      id: 'like-is-a-set',
      text: '좋아요를 (글, 사용자) 쌍의 고유 행으로 두면 같은 사용자가 여러 번 눌러도 한 번만 세진다는 것을 설명할 수 있어요.',
    },
    {
      id: 'hot-row-queue',
      text: '같은 카운터 행을 여러 요청이 UPDATE 하면 행 락 때문에 차례로 기다린다는 것을 설명할 수 있어요.',
    },
    {
      id: 'write-strategy-tradeoff',
      text: '샤딩, 버퍼링, 이벤트 로그 집계가 각각 무엇을 빠르게 하고 무엇을 늦추거나 잃게 하는지 말할 수 있어요.',
    },
    {
      id: 'idempotent-toggle',
      text: 'PUT으로 상태를 설정하고 DELETE로 해제하면 재시도와 더블 탭에도 같은 결과가 나온다는 것을 알아요.',
    },
    {
      id: 'read-your-own-write',
      text: '내 좋아요는 바로 보여 주고 총합은 잠깐 늦어도 된다는 기준을 세울 수 있어요.',
    },
    {
      id: 'approximate-views',
      text: '조회수는 정확한 값보다 근사치와 중복 제거 기간을 정하는 것이 흔한 선택이라는 것을 알아요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — UPDATE 명령과 갱신 행 수',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (행 수준 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — INSERT와 ON CONFLICT DO NOTHING',
      url: 'https://www.postgresql.org/docs/current/sql-insert.html',
    },
    {
      title: 'Redis 문서 — INCR',
      url: 'https://redis.io/docs/latest/commands/incr/',
    },
    {
      title: 'Redis 문서 — PFADD (HyperLogLog, 표준 오차 0.81%)',
      url: 'https://redis.io/docs/latest/commands/pfadd/',
    },
    {
      title: 'Redis 문서 — PFCOUNT (HyperLogLog 추정치)',
      url: 'https://redis.io/docs/latest/commands/pfcount/',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (멱등 메서드, 409 Conflict)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'MDN — Navigator.sendBeacon()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon',
    },
    {
      title: 'Google Cloud 문서 — Firestore 빈도 높은 카운터와 분산 카운터 (샤드)',
      url: 'https://cloud.google.com/firestore/docs/solutions/counters',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
