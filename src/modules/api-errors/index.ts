import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'api-errors',
  track: 'cases',
  order: 25,
  title: '에러 응답 설계 — 상태 코드와 문제 형식',
  question: "서버가 400에 'Bad Request' 한 줄만 주는데, 어떤 입력이 틀렸는지 화면에 어떻게 보여 줘야 할까요?",
  summary:
    '상태 코드는 실패의 종류를 알려 주지만, 어느 칸이 틀렸는지와 다시 시도해도 되는지는 말하지 않아요. 200에 에러를 담으면 FE가 실패를 성공으로 읽을 수 있어요. 이 글은 RFC 9457 문제 형식으로 상태, 종류, 칸 위치를 한 모양에 담는 방법과, FE 파서가 칸 오류 · 전역 메시지 · 재시도 버튼을 나누는 기준을 다뤄요.',
  minutes: 18,
  tags: ['HTTP', '상태 코드', 'problem+json', '검증', '재시도'],
  checklist: [
    {
      id: 'status-responsibility',
      text: 'RFC 9110 정의를 근거로 4xx는 요청을 고쳐야 하는 쪽, 5xx는 서버 쪽 사정이라는 것을 설명할 수 있어요.',
    },
    {
      id: 'status-200-error',
      text: '200으로 실패를 보내면 fetch의 ok가 성공으로 읽고 재시도 신호도 사라지는 이유를 설명할 수 있어요.',
    },
    {
      id: 'problem-members',
      text: 'type · title · status · detail · instance가 RFC 9457에서 각각 무슨 역할인지 설명할 수 있어요.',
    },
    {
      id: 'field-pointer',
      text: 'errors 확장에 pointer를 담으면 입력칸의 위치를 찾을 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'type-vs-detail',
      text: 'FE 분기는 type과 상태 코드로 하고, detail은 파싱하지 않고 화면 문장으로만 쓴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'no-internals',
      text: '스택이나 SQL을 응답에 넣지 않고, 요청 번호(instance)로 서버 로그를 찾는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'fe-parser',
      text: '응답 파서를 한 곳에 두고, 칸 오류 · 전역 메시지 · 재시도 버튼을 응답 모양에 따라 나눠 그릴 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9457 — Problem Details for HTTP APIs (3 Problem Details 객체, 3.2 확장 멤버, 5 보안 고려사항)',
      url: 'https://www.rfc-editor.org/rfc/rfc9457',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (15 상태 코드, 10.2.3 Retry-After, 9.2.2 멱등 메서드)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (4. 429 Too Many Requests)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585',
    },
    {
      title: 'MDN — Response: ok property (상태 코드 200–299 여부)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Response/ok',
    },
    {
      title: 'OWASP Error Handling Cheat Sheet (일반 응답과 서버 로그, 스택 노출 예시)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html',
    },
    {
      title: 'OWASP Input Validation Cheat Sheet (클라이언트 검증은 우회될 수 있어요)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
