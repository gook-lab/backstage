import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'security-headers',
  track: 'cases',
  order: 30,
  title: '보안 응답 헤더와 CSP',
  question: '배포했더니 인라인 스크립트와 외부 분석 스크립트가 CSP 위반으로 막혀요. 서버 헤더가 뭘 막는 걸까요?',
  summary:
    '보안 응답 헤더는 브라우저에게 이 페이지를 어떻게 다룰지 알려 주는 지시서예요. CSP는 스크립트와 자원의 출처를, frame-ancestors는 삽입을, HSTS는 https 강제를 정해요. 헤더마다 FE 코드의 어떤 동작을 바꾸는지 정책 판정으로 따라가 봐요.',
  minutes: 20,
  tags: ['보안', 'HTTP', '배포'],
  checklist: [
    {
      id: 'csp-directive-name',
      text: '콘솔의 CSP 위반 문구에서 지시문 이름(script-src 등)을 찾을 수 있어요.',
    },
    {
      id: 'nonce-vs-hash',
      text: '인라인 스크립트를 nonce로 허용할지 해시로 허용할지 판단할 수 있어요.',
    },
    {
      id: 'report-only-rollout',
      text: 'Report-Only로 먼저 위반만 모아 보고 정책을 고치는 순서를 설명할 수 있어요.',
    },
    {
      id: 'unsafe-inline-ignored',
      text: "정책에 nonce나 해시가 있으면 'unsafe-inline'이 무시되는 이유를 설명할 수 있어요.",
    },
    {
      id: 'framing-precedence',
      text: 'frame-ancestors와 X-Frame-Options 중 어느 쪽이 우선하는지 말할 수 있어요.',
    },
    {
      id: 'hsts-scope',
      text: 'HSTS가 HTTP 응답에서 무시되고, includeSubDomains가 서브도메인까지 미치는 범위를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — Content-Security-Policy (CSP) 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy',
    },
    {
      title: 'MDN — CSP script-src 지시문',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src',
    },
    {
      title: 'MDN — Content-Security-Policy-Report-Only 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only',
    },
    {
      title: 'MDN — CSP frame-ancestors 지시문',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors',
    },
    {
      title: 'MDN — X-Frame-Options 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options',
    },
    {
      title: 'MDN — X-Content-Type-Options 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options',
    },
    {
      title: 'MDN — Referrer-Policy 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy',
    },
    {
      title: 'MDN — Strict-Transport-Security (HSTS) 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security',
    },
    {
      title: 'W3C — Content Security Policy Level 3',
      url: 'https://www.w3.org/TR/CSP3/',
    },
    {
      title: 'RFC 6797 — HTTP Strict Transport Security (HSTS)',
      url: 'https://www.rfc-editor.org/rfc/rfc6797',
    },
    {
      title: 'OWASP — HTTP Headers Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
