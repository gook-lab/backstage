import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'server-or-client',
  track: 'cases',
  order: 9,
  title: '서버 · 클라 처리 판단',
  question: '이 정렬 · 필터 · 계산은 서버와 클라이언트 중 어디서 해야 할까요?',
  summary:
    '돈과 재고, 데이터 크기, 즉각 반응, 계산 비용, 비밀 규칙을 기준으로 나눠 봐요. 응답에서 서버 처리를 알려 주는 신호와 검증을 두 번 하는 이유도 함께 정리해요.',
  minutes: 20,
  tags: ['API 설계', '보안', '캐시', '성능'],
  checklist: [
    {
      id: 'trust-decision',
      text: '돈, 권한, 재고를 정하는 값은 서버가 판단하고, 클라이언트가 보낸 값은 참고만 해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'size-decision',
      text: '데이터 건수와 이미 받아 둔 데이터를 기준으로 클라이언트 처리가 가능한지 말할 수 있어요.',
    },
    {
      id: 'shared-decision',
      text: '다른 사람이 동시에 바꾸는 값은 서버 값을 기준으로 맞추고, 화면에는 낙관적 값을 쓸 수 있는 구조를 설명할 수 있어요.',
    },
    {
      id: 'feedback-decision',
      text: '즉시 반응과 서버 확정을 나눠서 설계할 수 있어요.',
    },
    {
      id: 'heavy-decision',
      text: '무거운 계산을 Web Worker에 맡길지, 서버에서 할지 데이터 규모로 고를 수 있어요.',
    },
    {
      id: 'secret-decision',
      text: '비밀 규칙이 있으면 미리보기도 서버가 해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'response-signals',
      text: '응답의 page · cursor, 상태 코드, 캐시 헤더를 보고 BE가 어디서 처리하라고 기대하는지 알아볼 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — Input Validation Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
    },
    {
      title: 'MDN — Using Web Workers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers',
    },
    {
      title: 'MDN — Content-Encoding',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Encoding',
    },
    {
      title: 'MDN — HTTP caching',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
    },
    {
      title: 'MDN — ETag',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
    },
    {
      title: 'MDN — Server-Timing',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (9.2.2 멱등 메서드, 15.5.10 409 Conflict, 15.5.21 422 Unprocessable Content)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (429 Too Many Requests)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585.html',
    },
    {
      title: 'IETF 초안 — The Idempotency-Key HTTP Header Field',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
