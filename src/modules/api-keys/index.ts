import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'api-keys',
  track: 'cases',
  order: 67,
  title: 'API 키 발급과 관리 — 해시 저장 · 한 번 표시 · 키 회전',
  question:
    '개발자 설정 화면에서 API 키를 만들면 "이 키는 지금 한 번만 보여요"라고 띄우래요. 왜 다시 못 보여 주고, 키 목록에는 앞 몇 글자만 나오나요?',
  summary:
    '키 원문을 서버에 그대로 두면 DB나 로그가 샐 때 키가 그대로 쓰여요. 그래서 발급 때 한 번만 보여 주고 해시로 저장하는 편이 좋아요. 키는 권한 범위를 나누고, 겹침 기간을 둬서 회전하고, 샜을 때는 바로 폐기해요.',
  minutes: 20,
  tags: ['보안', 'API 설계', '인증', '운영'],
  checklist: [
    {
      id: 'hash-store',
      text: 'API 키 원문 대신 해시를 저장하는 이유와 한계를 설명할 수 있어요.',
    },
    {
      id: 'show-once',
      text: '발급 직후에만 전체 키를 보여 주는 이유를 설명할 수 있어요.',
    },
    {
      id: 'scope-least',
      text: '키마다 권한 범위를 나눠 최소 권한으로 만들 수 있어요.',
    },
    {
      id: 'rotate-overlap',
      text: '새 키 발급, 겹침 기간, 옛 키 폐기 순서로 키를 회전할 수 있어요.',
    },
    {
      id: 'header-not-url',
      text: '키를 Authorization 헤더로 보내고 URL 쿼리에 넣지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'public-vs-secret',
      text: '브라우저 코드에 둬도 되는 키와 서버에만 둬야 하는 키를 구분할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — REST Security Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Password Storage Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Secrets Management Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    },
    {
      title: 'Stripe — API keys',
      url: 'https://docs.stripe.com/keys',
    },
    {
      title: 'RFC 6750 — The OAuth 2.0 Authorization Framework: Bearer Token Usage',
      url: 'https://www.rfc-editor.org/rfc/rfc6750',
    },
    {
      title: 'Node.js — crypto.randomBytes',
      url: 'https://nodejs.org/api/crypto.html',
    },
    {
      title: 'GitHub Docs — About authentication to GitHub (token formats)',
      url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github',
    },
    {
      title: 'GitHub Docs — Supported secret scanning patterns',
      url: 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
