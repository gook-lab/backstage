import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'message-queue',
  track: 'cases',
  order: 14,
  title: '메시지 큐와 재처리 — 주문은 됐는데 메일과 포인트는 나중에',
  question: '주문은 됐다는데 메일과 포인트는 왜 몇 초 뒤에 반영될까요?',
  summary:
    '요청 안에서 끝낼 일과 큐에 넣고 뒤에서 처리할 일을 나눠요. 큐는 최소 한 번 전달만 보장하므로 소비자가 중복을 막아야 해요. 재시도 간격, 반복 실패를 모으는 DLQ, 가시성 시간, DB 저장과 발행을 묶는 아웃박스까지 직접 돌려 봐요.',
  minutes: 18,
  tags: ['메시지 큐', '비동기', '멱등성', 'DLQ', '재시도'],
  checklist: [
    {
      id: 'sync-or-async',
      text: '응답을 주기 전에 끝내야 할 일과 뒤로 넘겨도 되는 일을 나누고, 뒤로 넘긴 일의 완료를 화면에 어떻게 알릴지 말할 수 있어요.',
    },
    {
      id: 'at-least-once',
      text: '큐가 최소 한 번 전달을 보장하고 같은 메시지가 두 번 올 수 있다는 것을 설명하고, 소비자가 멱등하게 처리해야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'backoff-jitter',
      text: '재시도 간격을 지수로 늘리고 jitter 를 섞는 이유를, 같은 시각에 몰리는 재시도가 과부하를 키운다는 점과 함께 설명할 수 있어요.',
    },
    {
      id: 'dlq-limit',
      text: '재시도 한도(maxReceiveCount)를 넘긴 메시지를 DLQ 로 격리하고, DLQ 에 든 메시지가 이미 처리됐을 수도 있다는 것을 알아요.',
    },
    {
      id: 'visibility-window',
      text: '가시성 시간이 처리 시간보다 짧으면 같은 메시지가 다른 소비자에게 다시 보일 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'outbox',
      text: 'DB 저장과 메시지 발행을 따로 하면 어긋날 수 있다는 것과, 아웃박스 테이블에 같은 트랜잭션으로 쓴 뒤 발행하는 구조를 설명할 수 있어요.',
    },
    {
      id: 'fe-pending-state',
      text: '접수 응답과 처리 완료 상태를 구분해, 대기 · 완료 · 실패 상태를 폴링이나 실시간 알림으로 보여 줄 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (202 Accepted, 201 Created, Retry-After)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'AWS SQS 문서 — 표준 큐 (at-least-once 전달, 중복 · 순서 어긋남 가능)',
      url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html',
    },
    {
      title: 'AWS SQS 문서 — 가시성 제한 시간 (기본 30초, 최대 12시간, ChangeMessageVisibility)',
      url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html',
    },
    {
      title: 'AWS SQS 문서 — 데드 레터 큐 (maxReceiveCount, 같은 계정 · 리전, FIFO 순서 주의)',
      url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html',
    },
    {
      title: "AWS Builders' Library — Timeouts, retries, and backoff with jitter",
      url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/',
    },
    {
      title: 'Apache Kafka 설계 문서 — 파티션 순서와 전달 의미 (at-least-once)',
      url: 'https://kafka.apache.org/44/design/design/',
    },
    {
      title: 'microservices.io — Transactional outbox 패턴',
      url: 'https://microservices.io/patterns/data/transactional-outbox.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
