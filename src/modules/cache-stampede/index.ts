import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'cache-stampede',
  track: 'cases',
  order: 5,
  title: '캐시와 캐시 스탬피드',
  question: '캐시가 만료되는 순간 왜 서버가 터지나요?',
  summary:
    '캐시가 답하는 계층과 Cache-Control 로 수명을 정하는 법을 보고, 쓰기 뒤 옛 값이 되살아나는 경쟁과 TTL 안전망을 다뤄요. 인기 상품이 만료되는 순간 미스가 DB 로 몰리는 스탬피드를 요청 병합, TTL 지터, 조기 갱신, 옛 값 먼저 주기로 나눠 비교하고, FE 가 맞춰야 할 캐시 헤더와 가격 변경 안내까지 정리해요.',
  minutes: 20,
  tags: ['캐시', 'HTTP', 'Redis', '동시성', 'FE'],
  checklist: [
    {
      id: 'cache-layers',
      text: '브라우저, CDN, 앱 메모리, 공유 캐시, DB 가 각각 무엇을 잘하고 무엇을 어려워하는지 말할 수 있어요.',
    },
    {
      id: 'cache-control',
      text: 'max-age, s-maxage, no-store, private, stale-while-revalidate 가 각각 누구에게 어떤 허락을 주는지 구분할 수 있어요.',
    },
    {
      id: 'delete-race',
      text: '쓰기 뒤 캐시를 지워도 옛 값이 다시 저장되는 경쟁이 생길 수 있고, TTL 이 그 안전망이라는 것을 설명할 수 있어요.',
    },
    {
      id: 'never-cache-long',
      text: '결제 직전 가격과 재고는 오래 캐시하지 않고, 결제 시점에 다시 계산해야 한다는 것을 알아요.',
    },
    {
      id: 'stampede-cause',
      text: '인기 키가 만료되면 기다리던 미스가 한꺼번에 DB 로 가서 스탬피드가 생긴다는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'mitigations',
      text: '요청 병합, TTL 지터, 확률적 조기 갱신, 옛 값 먼저 주기가 각각 무엇을 줄이고 무엇을 치르는지 비교할 수 있어요.',
    },
    {
      id: 'fe-checkpoints',
      text: 'ETag 와 304 로 재검증하고, 해시가 붙은 파일과 API 응답의 캐시 헤더를 나누며, 가격이 바뀌면 결제 전에 알리는 FE 규칙을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9111 — HTTP Caching',
      url: 'https://www.rfc-editor.org/rfc/rfc9111',
    },
    {
      title: 'RFC 5861 — HTTP Cache-Control Extensions for Stale Content (stale-while-revalidate, stale-if-error)',
      url: 'https://www.rfc-editor.org/rfc/rfc5861',
    },
    {
      title: 'MDN — Cache-Control 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control',
    },
    {
      title: 'MDN — HTTP 캐싱 가이드',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
    },
    {
      title: 'MDN — ETag 헤더 (If-None-Match, 304)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
    },
    {
      title: 'Redis 문서 — SET 명령 (EX, PX, NX)',
      url: 'https://redis.io/docs/latest/commands/set/',
    },
    {
      title: 'Redis 문서 — EXPIRE 명령 (키 만료 시간)',
      url: 'https://redis.io/docs/latest/commands/expire/',
    },
    {
      title: 'Vattani, Chierichetti, Lowenstein — Optimal Probabilistic Cache Stampede Prevention (VLDB 2015, XFetch)',
      url: 'https://www.vldb.org/pvldb/vol8/p886-vattani.pdf',
    },
    {
      title: 'Go 참고 구현 — golang.org/x/sync/singleflight',
      url: 'https://pkg.go.dev/golang.org/x/sync/singleflight',
    },
    {
      title: 'TanStack Query 문서 — Caching Examples (같은 queryKey 공유)',
      url: 'https://tanstack.com/query/latest/docs/framework/react/guides/caching',
    },
    {
      title: 'TanStack Query 문서 — Important Defaults (staleTime, gcTime)',
      url: 'https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
