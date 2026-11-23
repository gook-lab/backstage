import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'auth-session-token',
  track: 'cases',
  order: 12,
  title: '로그인 유지 — 세션과 토큰',
  question: '액세스 토큰은 어디에 저장하고, 만료되면 어떻게 갱신해야 할까요?',
  summary:
    '서버 세션과 토큰을 폐기 · 확장성 · 크기로 비교해요. 쿠키 속성, localStorage 의 XSS 위험, 짧은 액세스 토큰과 리프레시 토큰 회전을 보고, 여러 요청이 동시에 401 을 받을 때 갱신을 하나로 묶는 이유를 시뮬레이터로 확인해요.',
  minutes: 25,
  tags: ['인증', '보안', 'API 설계', '쿠키'],
  checklist: [
    {
      id: 'store-choice',
      text: '액세스 토큰을 localStorage 에 두면 XSS 한 번으로 빠지는 이유를 설명할 수 있어요.',
    },
    {
      id: 'cookie-attrs',
      text: 'HttpOnly, Secure, SameSite 가 각각 막는 위험을 구분해서 말할 수 있어요.',
    },
    {
      id: 'session-vs-token',
      text: '서버 세션과 토큰(JWT)을 폐기 가능성과 크기 기준으로 비교할 수 있어요.',
    },
    {
      id: 'rotation',
      text: '리프레시 토큰 회전과 재사용 감지가 무엇을 막고, 어떤 대가가 있는지 설명할 수 있어요.',
    },
    {
      id: 'single-flight',
      text: '401 을 동시에 받은 요청들이 갱신 요청을 하나로 묶어야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'status-codes',
      text: '401 과 403 을 구분해서, 각각 클라이언트가 어떻게 응답해야 하는지 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9700 — OAuth 2.0 Security Best Current Practice (4.14 리프레시 토큰 보호)',
      url: 'https://www.rfc-editor.org/rfc/rfc9700.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (15.5.2 401 Unauthorized, 15.5.4 403 Forbidden)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'RFC 6265 — HTTP State Management Mechanism (5.2.6 HttpOnly, 6.1 최소 크기)',
      url: 'https://www.rfc-editor.org/rfc/rfc6265.html',
    },
    {
      title: 'RFC 7519 — JSON Web Token (JWT)',
      url: 'https://www.rfc-editor.org/rfc/rfc7519.html',
    },
    {
      title: 'MDN — HTTP 쿠키 (HttpOnly · Secure · SameSite · __Host- 접두사)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies',
    },
    {
      title: 'MDN — Set-Cookie 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie',
    },
    {
      title: 'MDN — Web Storage API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
    },
    {
      title: 'OWASP — Session Management Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — HTML5 Security Cheat Sheet (Local Storage)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Cross-Site Request Forgery Prevention Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
