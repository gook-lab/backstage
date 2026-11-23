import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'transactions',
  track: 'basics',
  order: 3,
  title: '트랜잭션 · 락 · 데드락',
  question: '두 사람이 동시에 저장하면 무슨 일이 생기나요?',
  summary:
    '같은 행을 동시에 고치면 한쪽 변경이 사라질 수 있어요. 원자적 UPDATE, FOR UPDATE, 버전 컬럼으로 막는 법과 데드락, 재시도를 안전하게 만드는 멱등성 키까지 정리해요.',
  minutes: 15,
  tags: ['DB', '동시성', 'HTTP'],
  checklist: [
    {
      id: 'lost-update',
      text: '읽고 앱에서 계산한 값을 덮어쓰면 동시 저장에서 변경이 사라질 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'lock-choice',
      text: '계산이 한 문장으로 끝나면 원자적 UPDATE 를, 정책 확인이 필요하면 FOR UPDATE 를 고를 수 있어요.',
    },
    {
      id: 'conflict-response',
      text: '저장 API 가 409 나 412 를 돌려줄 때 FE 가 무엇을 해야 하는지 말할 수 있어요.',
    },
    {
      id: 'deadlock',
      text: '데드락이 생기는 조건을 설명하고, 락 순서를 맞춰 예방할 수 있어요. 40P01 을 받으면 재시도 대상으로 본다는 것도 알아요.',
    },
    {
      id: 'idempotency-key',
      text: '더블 클릭과 네트워크 재시도에 같은 Idempotency-Key 를 보내야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'isolation-default',
      text: '사용 중인 DB 의 기본 격리 수준을 확인하고, 격리 수준을 올려도 read-modify-write 를 앱이 재시도해야 한다는 것을 알아요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 명시적 락 (Explicit Locking)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 격리 (Transaction Isolation)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'PostgreSQL 문서 — 잠금 설정 (deadlock_timeout)',
      url: 'https://www.postgresql.org/docs/current/runtime-config-locks.html',
    },
    {
      title: 'PostgreSQL 문서 — 오류 코드 부록 (40P01)',
      url: 'https://www.postgresql.org/docs/current/errcodes-appendix.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 튜토리얼 (원자성)',
      url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html',
    },
    {
      title: 'MySQL 8.4 — InnoDB 데드락',
      url: 'https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html',
    },
    {
      title: 'MySQL 8.4 — InnoDB 트랜잭션 격리 수준',
      url: 'https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (409, 412, If-Match)',
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
