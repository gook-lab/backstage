import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'batch-jobs',
  track: 'cases',
  order: 22,
  title: '배치 작업 — 정산과 대량 처리',
  question:
    '관리자 화면에서 "정산 실행"을 눌렀는데 몇 분째 돌고 있어요. 이런 작업은 서버에서 어떻게 돌아가고, 화면은 무엇을 보여 줘야 할까요?',
  summary:
    '요청 안에서 끝낼 수 없는 긴 작업은 작업 리소스로 만들어 202 로 받고, 상태를 따로 조회해요. 대량 처리는 청크로 나눠 체크포인트를 남기고, 재실행해도 결과가 같도록 멱등하게 짜고, 두 번 동시에 돌지 않게 잠가요.',
  minutes: 22,
  tags: ['배치', '멱등성', '동시성', '정산', '202'],
  checklist: [
    {
      id: 'job-resource',
      text: '긴 작업을 요청 안에서 기다리지 않고, 작업 리소스를 만들어 202 와 상태 조회 주소로 응답하는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'chunk-checkpoint',
      text: '대량 처리를 청크로 나누고, 청크를 커밋할 때 체크포인트를 남겨야 중간 실패 뒤 그 지점부터 이어 할 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'idempotent-rerun',
      text: '커밋 전에 죽은 부분을 다시 처리하면 같은 건이 두 번 정산될 수 있고, 건마다 이미 처리됐는지 확인해 건너뛰어야 한다는 것을 알아요.',
    },
    {
      id: 'single-runner',
      text: '같은 배치가 두 번 동시에 돌지 않도록 잠그는 방법(advisory lock 이나 SKIP LOCKED)을 고르고, 이유를 말할 수 있어요.',
    },
    {
      id: 'integer-money',
      text: '정산 금액을 부동소수점이 아니라 정수 최소 단위로 계산해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-job-ui',
      text: '진행률, 취소의 의미, 화면을 닫아도 작업이 계속된다는 안내, 중복 실행 버튼 막기를 화면에 어떻게 옮길지 정할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (202 Accepted, 멱등 메서드, 409 Conflict, Retry-After)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (Advisory Locks, 세션 · 트랜잭션 수준)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 시스템 관리 함수 (pg_try_advisory_lock 은 기다리지 않고 false 를 돌려줘요)',
      url: 'https://www.postgresql.org/docs/current/functions-admin.html',
    },
    {
      title: 'PostgreSQL 문서 — SELECT (FOR UPDATE SKIP LOCKED 와 불일치 조회)',
      url: 'https://www.postgresql.org/docs/current/sql-select.html',
    },
    {
      title: 'MDN — Number (정수를 정확히 나타내는 범위와 반올림)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
