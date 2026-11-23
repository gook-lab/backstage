import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'payment-idempotency',
  track: 'cases',
  order: 3,
  title: '결제 — 이중 결제 막기',
  question: '결제 버튼을 두 번 누르면 두 번 결제되나요?',
  summary:
    '카드사 승인은 우리 DB 트랜잭션 밖에 있어서 롤백할 수 없어요. 응답이 유실되면 결제 결과를 모르는 UNKNOWN 상태가 생겨요. 멱등성 키, 웹훅 중복 제거, 아웃박스로 이중 결제를 막는 방법을 직접 돌려 봐요.',
  minutes: 18,
  tags: ['결제', '멱등성', '웹훅', '동시성'],
  checklist: [
    {
      id: 'unknown-state',
      text: '응답을 받지 못한 결제는 실패도 성공도 아닌 UNKNOWN이고, 같은 요청을 다시 보내기 전에 주문 상태를 조회해야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'key-lifecycle',
      text: '결제 시도마다 키를 하나 만들고 재시도에는 같은 키를 쓰며, 같은 키에 다른 본문이 오면 422 라는 것을 설명할 수 있어요.',
    },
    {
      id: 'in-flight',
      text: '처리 중인 같은 키의 요청은 409로 받고, 화면에서는 기다림으로 처리한다는 것을 알아요.',
    },
    {
      id: 'webhook-dedupe',
      text: '웹훅은 두 번 오거나 순서가 바뀔 수 있어서, 이벤트 id로 중복을 걸러내고 처리 로직을 멱등하게 만든다는 것을 설명할 수 있어요.',
    },
    {
      id: 'redirect-not-proof',
      text: '결제 완료 페이지의 쿼리 문자열은 결제의 증거가 아니고, 서버가 금액을 대조하고 승인 API를 호출해야 한다는 것을 알아요.',
    },
    {
      id: 'outbox',
      text: 'DB 저장과 이벤트 발행을 따로 하면 한쪽이 사라질 수 있어서, 아웃박스 행을 같은 트랜잭션에 쓰고 소비자가 중복을 걸러낸다는 것을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Stripe 문서 — 멱등성 요청 (Idempotent requests)',
      url: 'https://docs.stripe.com/api/idempotent_requests',
    },
    {
      title: 'Stripe 문서 — 웹훅 모범 사례 (Best practices for using webhooks)',
      url: 'https://docs.stripe.com/webhooks/best-practices',
    },
    {
      title: 'IETF 초안 — The Idempotency-Key HTTP Header Field (draft-ietf-httpapi-idempotency-key-header-09)',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (409 Conflict, 422 Unprocessable Content)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'microservices.io — Transactional outbox 패턴',
      url: 'https://microservices.io/patterns/data/transactional-outbox.html',
    },
    {
      title: '토스페이먼츠 개발자센터 — 결제위젯 연동 (successUrl과 결제 승인)',
      url: 'https://docs.tosspayments.com/guides/v2/payment-widget/integration',
    },
    {
      title: '토스페이먼츠 개발자센터 — API 레퍼런스 (결제 승인, 결제 조회, 취소 멱등키)',
      url: 'https://docs.tosspayments.com/reference',
    },
    {
      title: '토스페이먼츠 개발자센터 — 에러 코드',
      url: 'https://docs.tosspayments.com/reference/error-codes',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
