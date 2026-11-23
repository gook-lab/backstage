import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'cart-stock',
  track: 'cases',
  order: 2,
  title: '장바구니와 재고 — 담아 둔 상품이 품절되는 순간',
  question: '장바구니에 담아 둔 상품이 결제하려는 순간 품절되는 건 왜일까요?',
  summary:
    '장바구니는 재고를 잡아 두지 않아요. 언제 재고를 줄일지, 원자적 UPDATE 로 초과 판매를 막는 법, 가격이 바뀐 뒤 결제 응답을 다루는 법까지 정리해요.',
  minutes: 18,
  tags: ['DB', '동시성', 'HTTP', '장바구니'],
  checklist: [
    {
      id: 'cart-is-not-reservation',
      text: '장바구니는 재고 예약이 아니라는 것과, 담긴 목록이 어디에 저장되는지에 따라 기기 간 동기화가 달라진다는 것을 설명할 수 있어요.',
    },
    {
      id: 'decrement-timing',
      text: '담을 때, 결제를 시작할 때, 결제가 확정될 때 중 어디서 재고를 줄일지 정하고, 각각의 품절 경험과 묶이는 재고 차이를 말할 수 있어요.',
    },
    {
      id: 'atomic-decrement',
      text: '`WHERE stock >= n` 조건과 영향받은 행 수를 함께 확인하면 초과 판매를 막는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'reservation-ttl',
      text: '보류에 만료 시간을 두는 이유와, 포기한 손님의 보류가 다른 손님의 구매를 막는 문제를 설명할 수 있어요.',
    },
    {
      id: 'server-recompute',
      text: '결제 때 가격과 합계를 서버가 다시 계산해야 하고, 클라이언트가 보낸 가격을 믿으면 안 된다는 것을 알아요.',
    },
    {
      id: 'fe-line-errors',
      text: '품절, 수량 부족, 가격 변경을 줄 단위의 구조화된 응답으로 받아 화면에 보여 줄 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — UPDATE 명령과 갱신 행 수',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 읽기 커밋 격리 수준 (WHERE 조건 재평가)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (FOR UPDATE 와 행 수준 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (멱등 메서드, 409 Conflict)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'Stripe API 문서 — Idempotent requests (API v1 응답 저장)',
      url: 'https://docs.stripe.com/api/idempotent_requests',
    },
    {
      title: 'Stripe API 문서 — Checkout Session 생성 (expires_at 기본 24시간)',
      url: 'https://docs.stripe.com/api/checkout/sessions/create',
    },
    {
      title: 'MDN — Web Storage API (localStorage 는 브라우저에 남아요)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
    },
    {
      title: 'IETF 초안 — The Idempotency-Key HTTP Header Field',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
