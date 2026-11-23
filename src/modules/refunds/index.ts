import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'refunds',
  track: 'cases',
  order: 80,
  title: '환불과 부분 취소 — 잔액 확인과 중복 환불 막기',
  question: '부분 환불 버튼을 두 번 누르면 두 번 환불되나요, 쿠폰 주문은 얼마를 돌려줘야 하나요?',
  summary:
    '환불 가능 잔액은 원 결제액에서 이미 환불한 합계를 뺀 값이에요. 동시에 들어온 환불 요청은 옛 잔액을 같이 읽어 둘 다 통과할 수 있어요. 조건부 갱신으로 한도를 지키고, 멱등성 키로 같은 요청을 묶는 방법을 다뤄요. 쿠폰 할인을 줄마다 나누는 예시 규칙과 비동기 환불 상태까지 정리해요.',
  minutes: 20,
  tags: ['DB', '결제', '동시성', '멱등성', '웹훅'],
  checklist: [
    {
      id: 'refund-balance',
      text: '환불 가능 잔액을 결제액에서 환불 합계를 뺀 값으로 계산하고, 서버가 그 값을 넘지 않게 막아야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'conditional-limit',
      text: '`WHERE`에 환불 한도 조건을 넣고 갱신 행 수가 0이면 거절하는 쓰기를 쓸 수 있어요.',
    },
    {
      id: 'idempotency-vs-limit',
      text: '멱등성 키는 같은 요청의 중복을, 조건부 갱신은 한도 초과를 막는다는 것을 구분해서 설명할 수 있어요.',
    },
    {
      id: 'allocation-rule',
      text: '쿠폰 할인을 줄마다 나누는 방식과 끝수 배정 규칙을 골라, 상품 하나만 취소할 때의 환불액을 계산할 수 있어요.',
    },
    {
      id: 'async-status',
      text: 'pending · succeeded · failed 상태를 구분하고, 요청 직후에는 접수 상태를 보여 주고 최종 상태는 웹훅으로 받을 수 있어요.',
    },
    {
      id: 'failure-path',
      text: '환불 실패를 같은 키로 재시도할 실패와 사용자에게 알릴 실패로 나눠 처리할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Stripe 문서 — Refunds (여러 번 환불, 환불 상태, 반영 기간)',
      url: 'https://docs.stripe.com/refunds',
    },
    {
      title: 'Stripe 문서 — Idempotent requests (POST와 멱등성 키, 파라미터 비교)',
      url: 'https://docs.stripe.com/api/idempotent_requests',
    },
    {
      title: 'PostgreSQL 문서 — UPDATE 명령과 갱신 행 수 · RETURNING',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (FOR UPDATE와 행 수준 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 읽기 커밋 격리 수준 (WHERE 조건 재평가)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: '토스페이먼츠 개발자센터 — 결제 취소 API (cancelAmount, 멱등키 헤더)',
      url: 'https://docs.tosspayments.com/reference',
    },
    {
      title: '토스페이먼츠 개발자센터 — 인증과 멱등키 (Idempotency-Key)',
      url: 'https://docs.tosspayments.com/reference/using-api/authorization',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
