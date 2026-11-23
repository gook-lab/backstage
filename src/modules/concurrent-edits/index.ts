import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'concurrent-edits',
  track: 'cases',
  order: 31,
  title: '동시 편집 · 낙관적 동시성 제어',
  question: '두 사람이 같은 글을 고치면 나중에 저장한 쪽이 앞 사람 수정을 덮어써요. 서버는 이걸 어떻게 막나요?',
  summary:
    '읽은 뒤 고친 값을 저장할 때 생기는 덮어쓰기(lost update)를 다뤄요. ETag와 If-Match로 조건을 걸면 서버가 412를 돌려주고, 버전 칼럼으로 같은 검사를 DB 안에서 해요. 충돌이 났을 때 FE가 고르는 처리와 낙관적 UI의 롤백도 함께 정리해요.',
  minutes: 20,
  tags: ['동시성', 'API 설계', 'HTTP', 'DB'],
  checklist: [
    {
      id: 'lost-update',
      text: '읽은 뒤 저장하는 흐름에서 나중 저장이 앞 수정을 덮어쓰는 이유를 설명할 수 있어요.',
    },
    {
      id: 'if-match',
      text: 'ETag를 GET 응답에서 받아 If-Match로 보내고, 412를 받았을 때의 의미를 말할 수 있어요.',
    },
    {
      id: 'precondition-required',
      text: '조건 헤더가 없는 수정을 428로 거절하는 서버 설정이 왜 필요한지 설명할 수 있어요.',
    },
    {
      id: 'version-column',
      text: '버전 칼럼을 WHERE 조건에 넣고 영향받은 행 수로 충돌을 확인하는 방법을 설명할 수 있어요.',
    },
    {
      id: 'conflict-ui',
      text: '충돌이 나면 다시 불러오기, 병합 화면, 마지막 저장 우선 중 무엇을 고를지 기준을 말할 수 있어요.',
    },
    {
      id: 'optimistic-rollback',
      text: '낙관적 UI로 먼저 보여 준 값을 실패 응답이 오면 되돌리는 흐름을 구현할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (13.1.1 If-Match, 15.5.10 409 Conflict, 15.5.13 412 Precondition Failed)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (428 Precondition Required)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585.html',
    },
    {
      title: 'MDN — ETag',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
    },
    {
      title: 'MDN — If-Match',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match',
    },
    {
      title: 'MDN — 412 Precondition Failed',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/412',
    },
    {
      title: 'MDN — 428 Precondition Required',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/428',
    },
    {
      title: 'MDN — Conditional requests',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests',
    },
    {
      title: 'PostgreSQL 문서 — 13.2.2 Read Committed Isolation Level',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'PostgreSQL 문서 — 13.3 Explicit Locking',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
