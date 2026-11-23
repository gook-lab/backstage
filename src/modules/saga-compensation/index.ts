import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'saga-compensation',
  track: 'cases',
  order: 64,
  title: '여러 서비스 주문 — 사가와 보상 작업',
  question: '결제는 됐는데 재고 서비스가 실패하면, 서버는 주문을 어떻게 되돌릴까요?',
  summary:
    '서비스마다 DB가 따로 있으면 한 트랜잭션으로 묶을 수 없어요. 사가는 로컬 트랜잭션을 순서대로 실행하고, 실패하면 보상 작업으로 앞선 단계를 되돌려요. 보상이 다시 실패할 때 어긋나는 상태와 재시도 조건을 직접 돌려 봐요.',
  minutes: 20,
  tags: ['사가', '보상 트랜잭션', '2PC', '오케스트레이션', '멱등성', '아웃박스'],
  checklist: [
    {
      id: 'no-single-tx',
      text: '서비스마다 DB가 다르면 한 트랜잭션으로 묶을 수 없는 이유와, 그 때문에 중간 상태가 잠깐 보일 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'two-pc-tradeoff',
      text: '2단계 커밋(2PC)이 여러 자원을 원자적으로 묶는 방법이라는 것과, 준비 상태의 트랜잭션이 락을 쥐고 있어서 서비스 간에 잘 쓰지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'saga-steps',
      text: '사가가 로컬 트랜잭션의 순서이고, 실패한 지점 앞의 단계를 역순으로 보상 작업을 실행한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'orchestration-vs-choreography',
      text: '중앙 오케스트레이터가 순서를 관리하는 방식과 이벤트로 이어 가는 코레오그래피 방식을 비교하고, 각각의 추적과 순환 의존 문제를 말할 수 있어요.',
    },
    {
      id: 'compensation-is-new-work',
      text: '보상은 되돌리기가 아니라 새 작업이라서, 이미 보낸 메일처럼 되돌릴 수 없는 단계는 보상으로 해결하지 못한다는 것을 알아요.',
    },
    {
      id: 'idempotent-compensation',
      text: '보상 작업을 멱등하게 만들고 진행 상태를 저장해야 보상이 실패해도 실패 지점부터 재개할 수 있다는 것을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Microsoft Azure Architecture Center — Saga 디자인 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/saga',
    },
    {
      title: 'Microsoft Azure Architecture Center — Compensating Transaction 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction',
    },
    {
      title: 'microservices.io — Pattern: Saga (Chris Richardson)',
      url: 'https://microservices.io/patterns/data/saga.html',
    },
    {
      title: 'AWS Prescriptive Guidance — Saga pattern',
      url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/saga-pattern.html',
    },
    {
      title: 'PostgreSQL 문서 — PREPARE TRANSACTION',
      url: 'https://www.postgresql.org/docs/current/sql-prepare-transaction.html',
    },
    {
      title: 'microservices.io — Transactional outbox',
      url: 'https://microservices.io/patterns/data/transactional-outbox.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
