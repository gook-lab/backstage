import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'usage-metering',
  track: 'cases',
  order: 73,
  title: '사용량 과금 — 집계 지연과 한도 판단',
  question: '사용량 숫자는 왜 실제보다 늦고, 한도를 넘어도 호출이 더 통과할까요?',
  summary:
    '요청마다 세는 대신 이벤트로 쌓아 집계하면 화면과 한도 판단이 집계 시점의 값을 봐요. 재전송된 이벤트를 한 번만 세는 멱등성 키, 월말 경계에 걸린 이벤트가 어느 달에 들어가는지, 마감 뒤 정정 항목까지 나눠서 정리해요.',
  minutes: 20,
  tags: ['과금', '멱등성', '요청 제한', '집계'],
  checklist: [
    {
      id: 'record-choice',
      text: '요청마다 카운터를 올리는 방식과 이벤트로 쌓아 집계하는 방식의 차이를 설명할 수 있어요.',
    },
    {
      id: 'idempotency-key',
      text: '재전송된 이벤트가 두 번 세어지지 않도록 호출 식별자를 설계할 수 있어요.',
    },
    {
      id: 'as-of',
      text: '집계 지연 때문에 화면 숫자가 늦는 이유를 설명하고, 기준 시각을 함께 보여 줄 수 있어요.',
    },
    {
      id: 'period-attribution',
      text: '늦게 도착한 이벤트를 발생 시각과 도착 시각 중 어느 기준으로 청구 달에 넣을지 고를 수 있어요.',
    },
    {
      id: 'hard-soft-limit',
      text: '하드 리밋과 소프트 리밋 중 무엇으로 막고 무엇으로 알릴지 나눌 수 있어요.',
    },
    {
      id: 'correction',
      text: '확정된 청구서를 고치지 않고 정정 항목으로 넘기는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Stripe — Create a billing meter event (identifier와 timestamp 규칙)',
      url: 'https://docs.stripe.com/api/billing/meter-event/create',
    },
    {
      title: 'Stripe — Record usage for billing (비동기 처리)',
      url: 'https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage',
    },
    {
      title: 'Stripe — Create and configure a meter (집계 방식 · Meter Event Adjustment)',
      url: 'https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure',
    },
    {
      title: 'Stripe — Basic usage-based billing (신규 연동은 Metronome 권장)',
      url: 'https://docs.stripe.com/billing/subscriptions/usage-based',
    },
    {
      title: 'PostgreSQL — INSERT (ON CONFLICT와 유일 인덱스 중재자)',
      url: 'https://www.postgresql.org/docs/current/sql-insert.html',
    },
    {
      title: 'AWS — API Gateway 요청 제한 (토큰 버킷 · best-effort)',
      url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html',
    },
    {
      title: 'Google Cloud — Quotas overview (속도 할당량 초기화 시각)',
      url: 'https://cloud.google.com/docs/quotas/overview',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
