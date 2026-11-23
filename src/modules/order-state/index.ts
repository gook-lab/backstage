import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'order-state',
  track: 'cases',
  order: 60,
  title: '주문 상태 전이 — 취소와 출고가 겹칠 때 서버가 정하는 순서',
  question: '취소 버튼을 화면에서만 숨기면 충분한가요, 취소와 출고가 동시에 오면 어떻게 되나요?',
  summary:
    '주문은 결제 대기부터 배송 완료까지 정해진 순서로만 바뀌어요. 허용 전이를 서버가 판정하고, 화면 버튼은 서버가 내려 준 동작으로 그리는 방법을 다뤄요. 동시 요청은 조건부 UPDATE로 한쪽만 통과시키고, 늦게 온 외부 이벤트가 상태를 되돌리지 않게 하는 방법까지 정리해요.',
  minutes: 20,
  tags: ['DB', '동시성', 'HTTP', '상태 기계', '웹훅'],
  checklist: [
    {
      id: 'transition-table',
      text: '주문 상태와 허용 전이를 표로 쓰고, 각 동작이 어느 상태에서만 가능한지 말할 수 있어요.',
    },
    {
      id: 'server-decides',
      text: '버튼 노출을 서버가 내려 준 가능한 동작으로 정하고, 화면에서만 막은 규칙이 API에서 뚫리는 이유를 설명할 수 있어요.',
    },
    {
      id: 'conditional-update',
      text: '`WHERE status = ...` 조건과 갱신 행 수 0을 보고, 동시 요청 중 하나만 통과시키는 쓰기를 쓸 수 있어요.',
    },
    {
      id: 'conflict-409',
      text: '거부 응답을 409와 현재 상태를 담은 Problem Details 본문으로 만들 수 있어요.',
    },
    {
      id: 'history-same-tx',
      text: '전이 이력을 상태 변경과 같은 트랜잭션에 남겨야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'late-events',
      text: '늦게 도착한 결제 통지나 택배 상태를 전이 규칙으로 걸러서 상태가 되돌아가지 않게 할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — UPDATE 명령과 갱신 행 수 · RETURNING',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 읽기 커밋 격리 수준 (WHERE 조건 재평가)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (FOR UPDATE와 행 수준 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 열거형 타입 (enum)',
      url: 'https://www.postgresql.org/docs/current/datatype-enum.html',
    },
    {
      title: 'PostgreSQL 문서 — 체크 제약 조건 (CHECK)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (409 Conflict, 조건부 요청 412, 멱등 메서드)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'RFC 9457 — Problem Details for HTTP APIs',
      url: 'https://www.rfc-editor.org/rfc/rfc9457',
    },
    {
      title: 'Stripe 문서 — PaymentIntent 수명 주기 (취소 가능 시점)',
      url: 'https://docs.stripe.com/payments/paymentintents/lifecycle',
    },
    {
      title: 'Stripe 문서 — 웹훅 (이벤트 순서 보장 없음 · 중복 수신 · 빠른 2xx 응답)',
      url: 'https://docs.stripe.com/webhooks',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
