import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'notification-inbox',
  track: 'cases',
  order: 63,
  title: '알림함 — 안 읽은 개수 배지와 모두 읽음',
  question:
    '종 아이콘의 빨간 숫자가 실제 안 읽은 알림 수와 자꾸 달라요. 서버는 읽음 상태와 개수를 어떻게 관리해야 할까요?',
  summary:
    '알림을 행으로 저장할지, 읽음을 행마다 기록할지 커서 하나로 표현할지 고르는 일부터 시작해요. 안 읽은 개수를 매번 셀지 카운터로 둘지, 카운터가 어긋날 때 어떻게 맞출지, 모두 읽음을 커서 이동으로 처리하는 법까지 정리해요.',
  minutes: 20,
  tags: ['DB', '캐시', '동시성', '알림'],
  checklist: [
    {
      id: 'storage-model',
      text: '알림을 사용자별 행으로 저장할 때와 공지 한 건 + 읽음 기록으로 저장할 때 쓰기와 읽기 비용이 어디로 옮겨 가는지 설명할 수 있어요.',
    },
    {
      id: 'read-marker',
      text: '행마다 read_at을 두는 방식과 읽음 커서를 두는 방식의 차이를 알고, 커서로 가운데 알림 하나를 읽을 때 예외 행이 필요한 이유를 설명할 수 있어요.',
    },
    {
      id: 'count-vs-counter',
      text: '안 읽은 개수를 COUNT로 셀 때와 카운터 칸에 둘 때의 비용과 어긋남 위험을 비교할 수 있어요.',
    },
    {
      id: 'counter-drift',
      text: '영향받은 행 수를 확인하지 않고 카운터를 차감하면 칸이 실제보다 작아지는 이유와, 재계산으로 맞추는 방법을 설명할 수 있어요.',
    },
    {
      id: 'read-all-cursor',
      text: '모두 읽음을 행 단위 UPDATE 대신 커서 이동으로 처리할 때 갱신 행 수가 어떻게 달라지는지 설명할 수 있어요.',
    },
    {
      id: 'tab-sync',
      text: '같은 브라우저 탭 사이 배지는 BroadcastChannel로 맞추고, 여러 기기 사이 실시간 전달은 별도 글로 넘긴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'retention',
      text: '오래된 알림을 기간 단위로 정리할 때 대량 DELETE 대신 파티션을 떼는 방식이 나은 이유와, 정리하면서 카운터를 맞춰야 하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 부분 인덱스 (WHERE 조건과 술어의 일치)',
      url: 'https://www.postgresql.org/docs/current/indexes-partial.html',
    },
    {
      title: 'PostgreSQL 문서 — UPDATE 명령 (조건을 만족하는 모든 행, 갱신 행 수)',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'PostgreSQL 문서 — 인덱스 전용 스캔 (가시성 정보는 힙 항목에만 있어요)',
      url: 'https://www.postgresql.org/docs/current/indexes-index-only-scans.html',
    },
    {
      title: 'PostgreSQL 위키 — Slow Counting (COUNT(*)와 순차 스캔)',
      url: 'https://wiki.postgresql.org/wiki/Slow_Counting',
    },
    {
      title: 'PostgreSQL 문서 — 정기 진공 작업 (대량 UPDATE 뒤의 죽은 행 버전)',
      url: 'https://www.postgresql.org/docs/current/routine-vacuuming.html',
    },
    {
      title: 'PostgreSQL 문서 — 테이블 파티셔닝 (파티션 DROP과 대량 삭제 비교)',
      url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html',
    },
    {
      title: 'MDN — BroadcastChannel (같은 출처의 문서 사이 메시지, 보낸 객체 제외)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel',
    },
    {
      title: 'MDN — Page Visibility API (visibilitychange와 visibilityState)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
