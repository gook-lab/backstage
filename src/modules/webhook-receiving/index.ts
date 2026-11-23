import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'webhook-receiving',
  track: 'cases',
  order: 20,
  title: '웹훅 수신 — 결제 완료는 누가 알려 주나요',
  question: '결제창에서 돌아왔는데 주문이 아직 결제 대기예요. 서버는 결제 완료를 언제 알게 되나요?',
  summary:
    '브라우저 복귀는 창을 닫으면 오지 않아요. 결제 서버가 보내는 웹훅이 진실의 원천이에요. 서명 검증, 중복과 순서 뒤바뀜, 재시도, 놓친 웹훅을 대사로 맞추는 방법을 직접 돌려 봐요.',
  minutes: 20,
  tags: ['웹훅', '결제', '멱등성', '서명', '대사'],
  checklist: [
    {
      id: 'return-is-not-truth',
      text: '브라우저 복귀 요청은 사용자가 창을 닫으면 오지 않는다는 것과, 그래서 완료 판단의 근거가 될 수 없다는 것을 설명할 수 있어요.',
    },
    {
      id: 'verify-signature',
      text: '웹훅 요청을 원문(raw body)으로 서명 검증하고, 타임스탬프 허용 범위를 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'dedupe-and-order',
      text: '이벤트 ID 로 중복을 걸러내고, 도착 순서가 바뀔 수 있으니 허용된 상태 전이만 적용해야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'ack-fast-then-queue',
      text: '웹훅 핸들러는 서명을 확인하고 빠르게 2xx 를 돌려준 뒤, 무거운 처리는 큐로 넘긴다는 구조를 그릴 수 있어요.',
    },
    {
      id: 'reconcile-missed',
      text: '웹훅은 유실되거나 재시도 기간이 끝날 수 있으니, PG 조회 API 로 주기적으로 주문 상태를 맞추는 대사가 필요하다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-confirming-state',
      text: '복귀 직후 결제 대기 상태를 "확인 중"으로 보여 주고, 결과가 확정되면 화면을 갱신하는 흐름을 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Stripe 문서 — Webhooks (재시도 · 이벤트 순서 · 중복 전송 · 타임스탬프 허용 범위)',
      url: 'https://docs.stripe.com/webhooks',
    },
    {
      title: 'Stripe 문서 — Webhook 서명 검증',
      url: 'https://docs.stripe.com/webhooks/signature',
    },
    {
      title: '토스페이먼츠 문서 — 웹훅 이벤트 (헤더 · 서명 검증 · eventId)',
      url: 'https://docs.tosspayments.com/reference/using-api/webhook-events',
    },
    {
      title: '토스페이먼츠 문서 — 웹훅 연결하기 (10초 이내 200 응답 · 재전송 정책)',
      url: 'https://docs.tosspayments.com/guides/v2/webhook',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
