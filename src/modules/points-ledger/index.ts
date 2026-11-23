import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'points-ledger',
  track: 'cases',
  order: 83,
  title: '포인트 · 적립금 원장 — 거래 기록으로 잔액 맞추기',
  question:
    '마이페이지 포인트 잔액이 내역 합계와 안 맞아요. 곧 만료될 포인트부터 쓰인다는데, 주문을 취소하면 이미 만료된 포인트는 어떻게 되나요?',
  summary:
    '잔액 열만 고치면 내역과 어긋나도 왜 바뀌었는지 추적할 수 없어요. 거래를 덧붙이기만 하는 원장에 쌓고, 잔액은 기록의 합계로 구하는 방법을 다뤄요. 만료 임박 순 사용, 취소 때 만료된 묶음 처리, 음수 잔액 막기, 대조 배치까지 정리해요.',
  minutes: 20,
  tags: ['DB', '동시성', '데이터 모델', '배치'],
  checklist: [
    {
      id: 'balance-column-drift',
      text: '잔액 열만 고치면 내역과 잔액이 어긋나는 경로를 설명할 수 있어요.',
    },
    {
      id: 'ledger-correction',
      text: '거래 행을 지우지 않고 반대 행을 더해 정정하는 원장을 설계할 수 있어요.',
    },
    {
      id: 'lot-fifo',
      text: '묶음별 만료일을 기준으로 만료 임박 순 사용 배분을 계산할 수 있어요.',
    },
    {
      id: 'cancel-expired-lot',
      text: '사용 취소 때 만료된 묶음 몫을 세 가지 정책에 따라 원장 행으로 쓸 수 있어요.',
    },
    {
      id: 'non-negative-update',
      text: '조건부 UPDATE로 잔액이 음수가 되지 않게 막는 쓰기를 쓸 수 있어요.',
    },
    {
      id: 'snapshot-check',
      text: '잔액 스냅샷을 원장 합계와 대조하는 배치를 설계할 수 있어요.',
    },
    {
      id: 'fe-same-response',
      text: 'FE가 잔액과 내역을 같은 응답에서 받아 화면을 맞출 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — UPDATE (갱신된 행 수, 0행은 오류가 아님)',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 잠금 (FOR UPDATE 행 잠금)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 제약조건 (CHECK 제약의 범위)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'Martin Fowler — Event Sourcing',
      url: 'https://martinfowler.com/eaaDev/EventSourcing.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
