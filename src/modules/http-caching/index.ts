import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'http-caching',
  track: 'cases',
  order: 32,
  title: 'API 응답 HTTP 캐시 — 개인 캐시와 공유 캐시의 저장 범위',
  question: '배포했는데 사용자 화면에 옛 데이터가 남아 있어요. 브라우저, CDN, 서버 중 누가 캐시한 걸까요?',
  summary:
    '응답 헤더가 정하는 신선 기간과 저장 범위에 따라 브라우저와 공유 캐시가 각각 다르게 동작해요. max-age, s-maxage, no-store, private, ETag 재검증, stale-while-revalidate, Vary를 한 응답에서 따라가요.',
  minutes: 16,
  tags: ['HTTP', '캐시', 'CDN', 'API'],
  checklist: [
    {
      id: 'two-cache-layers',
      text: '개인 캐시와 공유 캐시가 같은 응답을 따로 저장할 수 있고, 헤더로 각각의 범위를 정할 수 있어요.',
    },
    {
      id: 'freshness-window',
      text: 'max-age와 s-maxage 기간 안에서는 원 서버에 묻지 않고 저장본을 쓴다는 것과, 공유 캐시가 s-maxage를 먼저 읽는다는 것을 알아요.',
    },
    {
      id: 'heuristic-without-cache-control',
      text: 'Cache-Control이 없으면 Last-Modified로 추정한 기간이 캐시마다 다를 수 있어서 응답에 기간을 명시하는 편이 낫다는 것을 설명할 수 있어요.',
    },
    {
      id: 'no-store-private-auth',
      text: 'no-store와 private의 저장 범위 차이, Authorization 요청에 공유 캐시가 저장본을 쓰는 조건을 구분할 수 있어요.',
    },
    {
      id: 'etag-304',
      text: '만료된 저장본을 ETag로 재검증해서 본문 없이 304를 받으면 저장본을 쓴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-origin-check',
      text: '응답의 Cache-Control과 Age를 보고 옛 데이터가 어느 층에서 왔는지 좁혀 볼 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9111 — HTTP Caching (신선도 · 저장 범위 · Cache-Control 지시어)',
      url: 'https://www.rfc-editor.org/rfc/rfc9111',
    },
    {
      title: 'RFC 5861 — HTTP Stale Controls (stale-while-revalidate, stale-if-error)',
      url: 'https://www.rfc-editor.org/rfc/rfc5861',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (조건부 요청 · 304 · Vary)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'MDN — HTTP caching 가이드 (개인 캐시 · 공유 캐시 · 휴리스틱 · no-cache)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
