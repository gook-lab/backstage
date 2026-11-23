import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'subscription-billing',
  track: 'cases',
  order: 79,
  title: '구독 결제 — 갱신 실패 · 플랜 변경 · 해지 판단',
  question:
    '카드 결제가 실패한 사용자가 프리미엄을 계속 쓰고, 플랜을 중간에 올리면 금액이 이상한데, 서버는 구독 상태를 어떻게 관리해요?',
  summary:
    '구독은 한 번의 결제가 아니라 상태가 바뀌는 기간 계약이에요. 갱신 실패 뒤의 재시도와 유예, 중간 플랜 변경의 일할 계산, 즉시 해지와 기간 끝 해지를 비교해요. 권한은 웹훅으로 받은 상태를 서버가 저장한 값으로 판단한다는 점도 함께 정리해요.',
  minutes: 22,
  tags: ['결제', '상태 머신', '웹훅', '시간'],
  checklist: [
    {
      id: 'status-machine',
      text: 'trialing, active, past_due, unpaid, canceled, incomplete 상태가 각각 무엇을 뜻하는지 설명할 수 있어요.',
    },
    {
      id: 'dunning-grace',
      text: '갱신 실패 뒤 재시도와 유예 기간이 어떻게 이어지고, 기능 차단을 언제 할지 정책으로 정할 수 있어요.',
    },
    {
      id: 'proration-math',
      text: '일할 계산으로 미사용분 크레딧과 새 플랜 차감이 함께 잡히는 이유를 금액으로 설명할 수 있어요.',
    },
    {
      id: 'cancel-choice',
      text: '즉시 해지와 기간 끝 해지의 권한 기간과 환불 차이를 비교해서 고를 수 있어요.',
    },
    {
      id: 'server-authority',
      text: '결제 성공 화면을 믿지 않고, 웹훅으로 받은 상태를 서버 DB에 저장해 권한을 판단할 수 있어요.',
    },
    {
      id: 'out-of-order-events',
      text: '웹훅 순서가 바뀌거나 중복 도착해도 이벤트 ID 기록과 최신 상태 조회로 맞출 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Stripe 문서 — How subscriptions work (구독 상태 표와 결제 실패 흐름)',
      url: 'https://docs.stripe.com/billing/subscriptions/overview',
    },
    {
      title: 'Stripe 문서 — Prorations (일할 계산과 proration_behavior)',
      url: 'https://docs.stripe.com/billing/subscriptions/prorations',
    },
    {
      title: 'Stripe 문서 — Automate payment retries (Smart Retries와 커스텀 재시도 규칙)',
      url: 'https://docs.stripe.com/billing/revenue-recovery/smart-retries',
    },
    {
      title: 'Stripe 문서 — Cancel subscriptions (즉시 해지와 cancel_at_period_end)',
      url: 'https://docs.stripe.com/billing/subscriptions/cancel',
    },
    {
      title: 'Stripe 문서 — Using webhooks with subscriptions (구독 이벤트와 상태 확인)',
      url: 'https://docs.stripe.com/billing/subscriptions/webhooks',
    },
    {
      title: 'Stripe 문서 — Webhooks (이벤트 순서 미보장과 중복 수신)',
      url: 'https://docs.stripe.com/webhooks',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
