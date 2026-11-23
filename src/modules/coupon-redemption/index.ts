import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'coupon-redemption',
  track: 'cases',
  order: 58,
  title: '쿠폰 적용 — 1인 1회와 총 수량 한도',
  question: '같은 쿠폰을 두 탭에서 동시에 쓰면 할인이 두 번 들어가나요?',
  summary:
    '쿠폰 규칙과 사용 기록을 나눠 두면 한도를 어디서 지킬지 보여요. 1인 1회는 유일 제약으로, 총 수량은 조건부 UPDATE로 막는 법을 다뤄요. 예약 · 확정 · 해제 흐름, 할인 금액을 서버에서 다시 계산하는 이유, 환불 때 쿠폰 처리까지 정리해요.',
  minutes: 18,
  tags: ['DB', '동시성', '결제', '쿠폰'],
  checklist: [
    {
      id: 'rule-vs-record',
      text: '쿠폰 규칙(할인 방식 · 수량)과 사용 기록(누가 · 어떤 주문에 · 어떤 상태로)을 따로 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'unique-per-user',
      text: '(쿠폰, 사용자) 쌍에 UNIQUE 제약을 두면 두 탭의 동시 사용 중 하나만 통과한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'conditional-decrement',
      text: '`remaining > 0` 조건을 붙인 UPDATE의 영향받은 행 수가 0이면 수량 소진으로 보고 롤백해야 한다는 것을 알아요.',
    },
    {
      id: 'reserve-confirm-release',
      text: '예약 · 확정 · 해제 상태가 각각 언제 바뀌고, 해제가 두 번 불려도 수량이 두 번 돌아가지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'server-recompute',
      text: '할인 금액을 클라이언트가 보낸 값이 아니라 서버가 쿠폰 규칙과 DB 가격으로 다시 계산해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'refund-policy',
      text: '환불 때 쿠폰을 복구할지 정하는 기준(유효 기간 · 부분 환불)을 정책으로 명시해야 한다는 것을 알아요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 제약 조건 (UNIQUE 제약과 NULL 비교)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — INSERT (ON CONFLICT DO UPDATE ... WHERE, RETURNING)',
      url: 'https://www.postgresql.org/docs/current/sql-insert.html',
    },
    {
      title: 'PostgreSQL 문서 — UPDATE (갱신 행 수와 RETURNING)',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 격리 (Read Committed와 WHERE 재평가)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'Stripe API 문서 — Coupons (max_redemptions, amount_off)',
      url: 'https://docs.stripe.com/api/coupons',
    },
    {
      title: 'Stripe API 문서 — Promotion codes (max_redemptions, restrictions)',
      url: 'https://docs.stripe.com/api/promotion_codes',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (409 Conflict)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
