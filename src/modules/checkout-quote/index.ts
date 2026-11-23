import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'checkout-quote',
  track: 'cases',
  order: 82,
  title: '결제 금액 확정 — 견적 스냅샷과 서버 재계산',
  question: '결제 직전에 금액이 바뀌면 서버는 어떤 금액을 믿고, 사용자에게 무엇을 보여 줘야 할까요?',
  summary:
    '클라이언트가 보낸 금액은 참고값으로만 받아요. 서버는 견적을 스냅샷으로 저장하고, 결제 요청에서 견적 id로 금액을 다시 계산해 비교해요. 값이 다르면 바뀐 항목을 담아 거절하고, 사용자가 확인한 뒤 새 견적으로 진행하는 흐름을 정리해요.',
  minutes: 16,
  tags: ['API', '결제', '견적', '가격'],
  checklist: [
    {
      id: 'server-recompute',
      text: '클라이언트가 보낸 가격과 합계를 믿지 않고, 서버가 상품 가격 · 쿠폰 · 배송비를 다시 계산해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'quote-snapshot',
      text: '견적 id, 줄별 금액, 만료 시각을 서버에 저장해 결제 요청이 어떤 금액을 가리키는지 고정할 수 있어요.',
    },
    {
      id: 'compare-and-reject',
      text: '재계산 값과 저장된 견적이 다르면 거절하고, 바뀐 항목을 응답에 담아 보낼 수 있어요.',
    },
    {
      id: 'pin-timing',
      text: '가격은 견적에 기록해 결제 때 비교하고 재고는 결제 시점에 확인하는 것처럼, 항목마다 확인 시점을 정하는 기준을 말할 수 있어요.',
    },
    {
      id: 'pg-amount-check',
      text: '토스페이먼츠 결제 승인 전에 successUrl의 amount와 서버 저장값을 비교해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-reconfirm',
      text: '바뀐 항목을 사용자에게 보여 주고 다시 확인받은 뒤 새 견적으로 결제를 진행하는 FE 흐름을 만들 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — Business Logic Security Cheat Sheet (Prices and Totals, Expire Partial States)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html',
    },
    {
      title: '토스페이먼츠 — 결제위젯 연동 가이드 (setAmount, successUrl 금액 확인)',
      url: 'https://docs.tosspayments.com/guides/v2/payment-widget/integration',
    },
    {
      title: '토스페이먼츠 — API 레퍼런스 (결제 승인 POST /v1/payments/confirm, 10분 만료)',
      url: 'https://docs.tosspayments.com/reference',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (15.5.10 409 Conflict, 15.5.21 422 Unprocessable Content)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
