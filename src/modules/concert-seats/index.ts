import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'concert-seats',
  track: 'cases',
  order: 1,
  title: '콘서트 좌석 선점',
  question: '1만 명이 같은 좌석을 동시에 누르면 누가 가져가나요?',
  summary:
    '결제 전에 좌석을 잠시 잡는 선점을 다뤄요. 읽고 나서 쓰면 생기는 이중 예약, 조건부 UPDATE 와 UNIQUE 제약, SKIP LOCKED 자동 배정, Redis SET NX PX 의 한계를 비교하고, 보류 만료와 늦은 결제 콜백, FE 가 409 와 카운트다운을 다루는 법까지 정리해요.',
  minutes: 18,
  tags: ['DB', '동시성', 'Redis', 'HTTP'],
  checklist: [
    {
      id: 'hold-vs-confirm',
      text: '선점(hold)과 결제 후 확정(confirm)을 나누는 이유를 설명하고, 좌석이 AVAILABLE, HELD, SOLD 로 바뀌는 흐름을 말할 수 있어요.',
    },
    {
      id: 'read-then-write',
      text: '읽고 나서 쓰는 패턴이 같은 좌석에 두 보류를 만드는 이유를 설명할 수 있어요.',
    },
    {
      id: 'conditional-update',
      text: '조건부 UPDATE 에서 영향받은 행 수가 0 이면 409 로 답해야 한다는 것을 알아요.',
    },
    {
      id: 'unique-and-skip',
      text: 'UNIQUE 제약은 중복 행을 DB 가 막게 하고, SKIP LOCKED 는 잠긴 행을 건너뛰어 자동 배정에 쓴다는 차이를 설명할 수 있어요.',
    },
    {
      id: 'redis-limits',
      text: 'Redis SET NX PX 로 보류를 만들 수 있지만, Redis 가 확정 기록의 원장이 아니고 장애 때 쓰기를 잃을 수 있다는 점을 알아요.',
    },
    {
      id: 'expiry-and-late-payment',
      text: '보류 만료를 지연 만료와 주기적 정리로 처리하는 법을 알고, 만료 뒤 도착한 결제는 DB 조건으로 다시 확인해 환불한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-checkpoints',
      text: '카운트다운을 서버 시간으로 맞추고, 409 를 받으면 좌석을 다시 받아 오며, 확정 전에는 SOLD 로 바꾸지 않는다는 FE 규칙을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — SELECT (FOR UPDATE / FOR SHARE, SKIP LOCKED)',
      url: 'https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE',
    },
    {
      title: 'PostgreSQL 문서 — 제약 조건 (UNIQUE 제약)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (Explicit Locking)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'Redis 문서 — SET 명령 (NX, PX, Null reply)',
      url: 'https://redis.io/docs/latest/commands/set/',
    },
    {
      title: 'Redis 문서 — 분산 락 패턴 (SET NX PX, Redlock 가정)',
      url: 'https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/',
    },
    {
      title: 'Redis 문서 — 복제 (비동기 복제와 장애 조치 중 쓰기 손실)',
      url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/replication/',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (409 Conflict, 412 Precondition Failed)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'IETF 초안 — The Idempotency-Key HTTP Header Field',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
