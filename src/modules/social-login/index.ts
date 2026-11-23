import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'social-login',
  track: 'cases',
  order: 55,
  title: '소셜 로그인 — 인가 코드 흐름과 PKCE',
  question: '돌아온 code를 프론트에서 바로 토큰으로 바꾸면 안 되나요?',
  summary:
    '로그인 버튼 뒤에서는 리다이렉트, code, 토큰 교환이 순서대로 일어나요. state가 콜백의 출처를 확인하고, PKCE가 가로챈 code를 쓸모없게 만드는 원리를 정리해요. ID 토큰은 iss · aud · exp · nonce · 서명을 확인한 뒤에만 믿어요.',
  minutes: 25,
  tags: ['인증', '보안', 'OAuth', 'PKCE'],
  checklist: [
    {
      id: 'code-flow-order',
      text: '리다이렉트, code 전달, 토큰 교환이 어떤 순서로 일어나는지 설명할 수 있어요.',
    },
    {
      id: 'implicit-risk',
      text: 'implicit 흐름에서 토큰이 URL에 실려 나가는 이유와 그래서 권장되지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'state-check',
      text: 'state가 무엇을 확인하고 무엇을 막지 못하는지 구분할 수 있어요.',
    },
    {
      id: 'pkce-s256',
      text: 'code_verifier와 S256 code_challenge가 가로챈 code를 어떻게 쓸모없게 만드는지 설명할 수 있어요.',
    },
    {
      id: 'id-token-checks',
      text: 'ID 토큰에서 iss · aud · exp · nonce · 서명을 확인해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'account-link-risk',
      text: '같은 이메일이라고 기존 계정에 자동으로 묶으면 생기는 위험을 판단할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 6749 — OAuth 2.0 Authorization Framework (인가 코드 · implicit · CSRF · 코드 1회 사용)',
      url: 'https://www.rfc-editor.org/rfc/rfc6749',
    },
    {
      title: 'RFC 7636 — PKCE (code_verifier · S256 · plain 기본값)',
      url: 'https://www.rfc-editor.org/rfc/rfc7636',
    },
    {
      title: 'RFC 9700 — OAuth 2.0 Security Best Current Practice (PKCE 요구 · implicit 비권장 · 정확 일치)',
      url: 'https://www.rfc-editor.org/rfc/rfc9700',
    },
    {
      title: 'OpenID Connect Core 1.0 — ID 토큰 검증 (3.1.3.7) · sub · email_verified',
      url: 'https://openid.net/specs/openid-connect-core-1_0.html',
    },
    {
      title: 'IETF 초안 — OAuth 2.0 for Browser-Based Applications (아직 RFC가 아니에요)',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
