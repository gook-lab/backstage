import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'booking-slots',
  track: 'cases',
  order: 62,
  title: '회의실 시간 예약',
  question:
    '회의실 예약에서 14:00~15:00과 14:30~15:30이 둘 다 잡혔어요. 서버는 겹치는 예약을 어떻게 막고, 빈 시간 목록은 어떻게 만들까요?',
  summary:
    '같은 방의 예약 시간이 겹치면 안 되지만, 확인과 저장이 떨어져 있으면 두 요청이 모두 통과할 수 있어요. 이 글은 반열린 구간 [start, end)과 겹침 조건을 정하고, PostgreSQL 배제 제약으로 DB가 막게 하는 방법과 확인 후 삽입의 경쟁을 비교해요. 빈 시간 계산, 시간대와 서머타임, 반복 예약까지 다뤄요.',
  minutes: 16,
  tags: ['DB', '동시성', '시간대', 'PostgreSQL'],
  checklist: [
    {
      id: 'overlap-condition',
      text: '두 구간이 겹치는지 a.start < b.end와 b.start < a.end 두 조건으로 판단할 수 있어요.',
    },
    {
      id: 'half-open',
      text: '끝 시각을 구간에서 빼는 [start, end) 표기로 15:00 끝과 15:00 시작이 겹치지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'check-then-insert',
      text: '확인 후 삽입이 같은 순간의 두 요청을 모두 통과시킬 수 있다는 것을 알아요.',
    },
    {
      id: 'exclusion',
      text: 'EXCLUDE USING gist로 방 id와 시간 구간을 함께 막는 제약을 쓸 수 있어요.',
    },
    {
      id: 'free-windows',
      text: '영업시간에서 예약 구간을 뺀 빈 시간 목록을 계산할 수 있어요.',
    },
    {
      id: 'timezone-dst',
      text: '예약은 UTC로 저장하고, 서머타임 날의 영업시간은 지역 규칙으로 계산한다는 것을 알아요.',
    },
    {
      id: 'fe-409',
      text: '23P01에서 온 409를 받으면 빈 시간 목록을 서버에서 다시 받아야 한다는 FE 규칙을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 범위 타입 (Range Types)',
      url: 'https://www.postgresql.org/docs/current/rangetypes.html',
    },
    {
      title: 'PostgreSQL 문서 — 배제 제약 (Exclusion Constraints)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE TABLE (EXCLUDE 절)',
      url: 'https://www.postgresql.org/docs/current/sql-createtable.html',
    },
    {
      title: 'PostgreSQL 문서 — btree_gist',
      url: 'https://www.postgresql.org/docs/current/btree-gist.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 격리 수준 (Transaction Isolation)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'PostgreSQL 문서 — 부록 A 오류 코드 (23P01, 40001)',
      url: 'https://www.postgresql.org/docs/current/errcodes-appendix.html',
    },
    {
      title: 'MDN — Date (서머타임 전환 때 없는 시각과 두 번 있는 시각)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date',
    },
    {
      title: 'MDN — Intl.DateTimeFormat (timeZone 옵션)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat',
    },
    {
      title: 'RFC 5545 — iCalendar, 3.3.10 Recurrence Rule (RRULE의 UNTIL · COUNT)',
      url: 'https://www.rfc-editor.org/rfc/rfc5545',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
