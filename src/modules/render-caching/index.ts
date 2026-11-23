import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'render-caching',
  track: 'cases',
  order: 54,
  title: '서버 렌더링 캐시 — 개인화와 공유 캐시 나누기',
  question: '로그인 여부로 헤더가 달라지는 상품 상세 페이지는 서버에서 어떻게 캐시하나요?',
  summary:
    '서버가 HTML을 만드는 시점을 요청마다, 재검증 간격마다, 빌드할 때로 나눠 봐요. 로그인 여부로 달라지는 부분을 공용 HTML에서 떼어 내면 공유 캐시를 계속 쓸 수 있어요. 가격이 바뀐 뒤 옛 값이 얼마나 남는지 시뮬레이터로 비교해요.',
  minutes: 22,
  tags: ['캐시', 'SSR', 'CDN', '개인화', 'FE'],
  checklist: [
    {
      id: 'render-timing',
      text: '요청마다, 재검증, 빌드 시 렌더링이 원 서버 호출 수와 옛 값 노출 시간을 어떻게 바꾸는지 말할 수 있어요.',
    },
    {
      id: 'split-personal',
      text: '공용 HTML과 개인 부분을 나눠서, 공용 부분만 공유 캐시에 두는 구조를 그릴 수 있어요.',
    },
    {
      id: 'cookie-cache',
      text: '쿠키가 붙은 요청이 공유 캐시에 저장본으로 답하지 않도록 응답 헤더나 캐시 설정으로 막는 방법을 설명할 수 있어요.',
    },
    {
      id: 'scope-invalidation',
      text: '경로 단위와 태그 단위 무효화의 범위 차이, 여러 인스턴스에서 무효화가 로컬에 머무는 경우를 설명할 수 있어요.',
    },
    {
      id: 'swr-render',
      text: 'stale-while-revalidate를 렌더링 결과에 적용하면 기다림은 줄고 옛 값은 남는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-signals',
      text: '응답의 캐시 신호와 개인 부분 호출을 보고, 옛 값이 어느 층에서 왔는지 좁혀 볼 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9111 — HTTP Caching (4.1 캐시 키와 Vary · 3.5 인증된 요청 · 5.2.2.7 private · 7.3 Set-Cookie)',
      url: 'https://www.rfc-editor.org/rfc/rfc9111',
    },
    {
      title: 'RFC 5861 — HTTP Stale Controls (3절 stale-while-revalidate)',
      url: 'https://www.rfc-editor.org/rfc/rfc5861',
    },
    {
      title: 'MDN — Cache-Control 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control',
    },
    {
      title: 'MDN — Vary 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
    },
    {
      title: 'Next.js — Incremental Static Regeneration (ISR) 가이드',
      url: 'https://nextjs.org/docs/app/guides/incremental-static-regeneration',
    },
    {
      title: 'Next.js — How revalidation works',
      url: 'https://nextjs.org/docs/app/guides/how-revalidation-works',
    },
    {
      title: 'Next.js — Using a CDN with Next.js',
      url: 'https://nextjs.org/docs/app/guides/cdn-caching',
    },
    {
      title: 'Next.js — How to implement authentication with Cache Components',
      url: 'https://nextjs.org/docs/app/guides/authentication-with-cache-components',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
