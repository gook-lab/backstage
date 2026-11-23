import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'webhook-sending',
  track: 'cases',
  order: 74,
  title: '웹훅 발송 — 고객 서버로 이벤트를 보내고 실패를 다루기',
  question: '웹훅 URL 등록 화면과 "다시 보내기" 버튼을 만든다면, 서버는 실패한 웹훅을 어떻게 다시 보내나요?',
  summary:
    '이벤트는 저장한 뒤 비동기로 보내요. 서명과 타임스탬프를 붙이고, 2xx만 성공으로 보고, 백오프로 재시도해요. 느린 고객은 큐를 나눠 격리하고, 계속 실패하면 멈추고 알려요.',
  minutes: 22,
  tags: ['웹훅', '재시도', '서명', 'SSRF', '큐', '격리'],
  checklist: [
    {
      id: 'store-then-send',
      text: '이벤트를 DB에 먼저 저장하고, 발송은 큐에서 비동기로 처리해야 요청과 발송이 서로의 실패에 묶이지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'sign-with-timestamp',
      text: '메시지 id와 타임스탬프를 포함해 HMAC으로 서명하고, 비밀을 회전할 때 두 서명을 함께 보내는 이유를 설명할 수 있어요.',
    },
    {
      id: 'retry-window',
      text: '지수 백오프와 jitter로 재시도 간격을 늘리고, 2xx만 성공으로 보며, 재시도 기간에 상한을 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'disable-and-notify',
      text: '실패가 오래 이어지면 엔드포인트 발송을 멈추고 고객에게 알려야 한다는 것과, 그 전에 확인할 발송 기록을 말할 수 있어요.',
    },
    {
      id: 'isolate-slow-tenant',
      text: '엔드포인트별 큐와 동시성 한도를 두면 느린 고객 하나가 다른 고객의 발송을 막지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'register-url-safely',
      text: '등록 URL은 https만 받고 내부 주소를 막아야 하며, DNS 결과 IP를 검사해야 SSRF를 줄일 수 있다는 것을 알아요.',
    },
  ],
  sources: [
    {
      title: 'Standard Webhooks 명세 (GitHub) — 서명 · 헤더 · 재시도 · 비활성화',
      url: 'https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md',
    },
    {
      title: 'Standard Webhooks 홈페이지',
      url: 'https://www.standardwebhooks.com/',
    },
    {
      title: 'Stripe 문서 — Webhooks (3일 지수 백오프 재시도 · 순서 · 중복)',
      url: 'https://docs.stripe.com/webhooks',
    },
    {
      title: 'GitHub 문서 — 실패한 웹훅 전달 처리 (10초 응답 · 자동 재전송 없음)',
      url: 'https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries',
    },
    {
      title: 'GitHub 문서 — 웹훅 재전송 (지난 3일 이내)',
      url: 'https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks',
    },
    {
      title: 'GitHub 문서 — 웹훅 전달 검증 (X-Hub-Signature-256, HMAC-SHA256)',
      url: 'https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries',
    },
    {
      title: 'OWASP — SSRF Prevention Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
    },
    {
      title: 'microservices.io — Transactional outbox 패턴',
      url: 'https://microservices.io/patterns/data/transactional-outbox.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
