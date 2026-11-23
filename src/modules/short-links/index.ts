import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'short-links',
  track: 'cases',
  order: 78,
  title: '짧은 링크 — 코드 만들기와 리다이렉트 상태 코드',
  question: '공유 링크를 바꿨는데 예전 주소로 계속 가는 사람이 있는 건 왜일까요?',
  summary:
    '짧은 링크는 코드와 대상 URL을 짝지은 표와 리다이렉트 응답으로 이뤄져요. 순번과 무작위 코드의 차이, 301과 302 같은 상태 코드가 캐시에 남기는 흔적, 클릭 집계가 응답을 늦추지 않는 법을 정리해요.',
  minutes: 18,
  tags: ['HTTP', '캐시', '리다이렉트', '보안', '집계'],
  checklist: [
    {
      id: 'code-tradeoff',
      text: '순번 base62와 무작위 코드의 차이를 충돌과 추측 가능성 관점에서 설명할 수 있어요.',
    },
    {
      id: 'code-length',
      text: '링크 수와 코드 길이로 가능한 경우의 수를 계산하고, 생일 문제 근사로 충돌 확률을 어림할 수 있어요.',
    },
    {
      id: 'status-choice',
      text: '301, 302, 307, 308의 영구 여부와 메서드 유지 차이를 알고, 대상을 바꿀 수 있는 링크에 맞는 코드를 고를 수 있어요.',
    },
    {
      id: 'redirect-cache',
      text: '리다이렉트 응답의 캐시 헤더가 대상 변경 뒤 재방문자에게 어떤 영향을 주는지 설명할 수 있어요.',
    },
    {
      id: 'open-redirect',
      text: '대상 URL을 검사하지 않으면 생기는 열린 리다이렉트 문제와, 허용 목록으로 막는 방법을 설명할 수 있어요.',
    },
    {
      id: 'fe-gone-state',
      text: '404와 410 응답을 "만료되었어요" 같은 화면 상태로 나누어 보여 줄 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (301 · 302 · 307 · 308, 404 · 410, 메서드 유지)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'RFC 9111 — HTTP Caching (저장 조건, 휴리스틱 신선도, no-store)',
      url: 'https://www.rfc-editor.org/rfc/rfc9111',
    },
    {
      title: 'MDN — Redirections in HTTP',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections',
    },
    {
      title: 'MDN — 301 Moved Permanently',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/301',
    },
    {
      title: 'MDN — 302 Found',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302',
    },
    {
      title: 'MDN — 307 Temporary Redirect',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/307',
    },
    {
      title: 'MDN — 308 Permanent Redirect',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/308',
    },
    {
      title: 'MDN — 410 Gone',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410',
    },
    {
      title: 'OWASP — Unvalidated Redirects and Forwards Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html',
    },
    {
      title: 'Slack 문서 — Unfurling links in messages (링크를 크롤링해 미리보기를 만들어요)',
      url: 'https://docs.slack.dev/messaging/unfurling-links-in-messages/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
