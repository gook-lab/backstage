import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'offline-sync',
  track: 'cases',
  order: 40,
  title: '오프라인 동기화 — 대기열 재전송과 변경 피드',
  question: '지하철에서 쓴 메모가 다시 연결되면 다른 기기의 수정과 섞여요. 서버는 변경을 어떻게 주고받나요?',
  summary:
    '오프라인에서 한 편집은 기기 안 대기열에 쌓였다가 연결되면 다시 보내져요. 서버는 동기화 토큰 이후 바뀐 것만 알려 주고, 삭제는 묘비로 알려요. 같은 항목을 두 기기가 고쳤을 때 마지막 쓰기 우선, 필드 병합, 사용자 선택 중 무엇을 고를지도 정리해요.',
  minutes: 22,
  tags: ['동기화', '오프라인', '충돌', 'API 설계', 'HTTP'],
  checklist: [
    {
      id: 'outbox',
      text: '오프라인 편집을 바뀐 필드, 기준 버전, 기기 순번과 함께 대기열에 쌓고 연결되면 순서대로 보낼 수 있어요.',
    },
    {
      id: 'online-hint',
      text: '`navigator.onLine`이 네트워크 연결만 알려 준다는 점을 알고, 재전송 신호로는 힌트로만 쓸 수 있어요.',
    },
    {
      id: 'sync-token',
      text: '증분 받기에서 시작 토큰이나 `nextSyncToken`을 저장하고 다음 요청에 되돌려 보낼 수 있어요.',
    },
    {
      id: 'token-gone',
      text: '410이나 40X 오류를 받았을 때 전체 다시 받기로 돌아가되, 아직 보내지 못한 대기열은 남겨야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'tombstone',
      text: '삭제를 묘비로 받아야 기기가 옛 항목을 지울 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'base-and-change',
      text: '기준 버전과 실제 변경을 함께 봐야 손대지 않은 필드를 살릴 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'put-client-id',
      text: '클라이언트가 고른 id로 PUT을 보내면 응답을 잃고 재전송해도 항목이 하나만 남는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — IndexedDB API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
    },
    {
      title: 'MDN — Navigator.onLine (값은 믿기 어려워 힌트로만 쓰라고 설명)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine',
    },
    {
      title: 'MDN — Background Synchronization API (Limited availability)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API',
    },
    {
      title: 'MDN — Service Worker API (프록시 역할, 백그라운드 동기화 접근)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API',
    },
    {
      title: 'Google Calendar API — 증분 동기화 (syncToken · 삭제 항목 · 410)',
      url: 'https://developers.google.com/workspace/calendar/api/guides/sync',
    },
    {
      title: 'Google Drive API — 변경 사항 가져오기 (getStartPageToken · changes.list)',
      url: 'https://developers.google.com/workspace/drive/api/guides/manage-changes',
    },
    {
      title: 'Microsoft Graph — delta query 개요 (nextLink · deltaLink · @removed · 410)',
      url: 'https://learn.microsoft.com/en-us/graph/delta-query-overview',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (9.2.2 멱등 메서드, 9.3.4 PUT, 15.5.11 410 Gone)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: '위키백과 — Conflict-free replicated data type (병합 함수 성질, Apple Notes 예)',
      url: 'https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
