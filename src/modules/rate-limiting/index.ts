import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'rate-limiting',
  track: 'cases',
  order: 17,
  title: '레이트 리밋 알고리즘 — 고정 창 · 슬라이딩 · 토큰 버킷 · 누수 버킷',
  question: '429 를 받았는데, 언제 다시 보내야 하고 서버는 어떤 기준으로 막는 걸까요?',
  summary:
    '서버는 키별로 요청을 창이나 버킷에 담아 세고, 한도를 넘으면 429 로 거절해요. 알고리즘마다 경계에서 통과하는 양이 달라서 같은 한도라도 1초 안에 처리되는 양이 달라요. 서버가 여럿이면 카운터를 어디에 두는지도 실제 한도를 바꿔요.',
  minutes: 16,
  tags: ['HTTP', 'Redis', '동시성'],
  checklist: [
    {
      id: 'window-edge-math',
      text: '고정 창 경계 앞뒤의 요청을 세어, 1초 구간에 처리되는 최대 수를 직접 계산할 수 있어요.',
    },
    {
      id: 'five-shapes',
      text: '고정 창, 슬라이딩 로그, 슬라이딩 카운터, 토큰 버킷, 누수 버킷을 저장하는 상태와 버스트 허용 방식으로 나눠 말할 수 있어요.',
    },
    {
      id: 'counter-estimate',
      text: '슬라이딩 카운터가 이전 창과 현재 창을 비율로 섞어 추정한다는 것과, 추정이라 한도를 조금 넘을 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'key-choice',
      text: '제한 키를 IP, 사용자, API 키 중에서 고를 때 공유 IP 와 로그인 전 요청을 고려할 수 있어요.',
    },
    {
      id: 'shared-counter',
      text: '서버가 여럿이면 각자 세는 카운터가 한도를 서버 수만큼 넘길 수 있고, 공유 저장소에서 원자적으로 세야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-retry-guard',
      text: '429 의 자동 재시도와 버튼 연타가 같은 요청을 여러 번 보내지 않도록 화면에서 막을 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (4. 429 Too Many Requests)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (Retry-After 헤더)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'IETF Internet-Draft — RateLimit header fields for HTTP (draft-ietf-httpapi-ratelimit-headers-12)',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/',
    },
    {
      title: 'nginx 문서 — ngx_http_limit_req_module',
      url: 'https://nginx.org/en/docs/http/ngx_http_limit_req_module.html',
    },
    {
      title: 'Amazon API Gateway 개발자 가이드 — Throttle requests to your REST APIs',
      url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html',
    },
    {
      title: 'Stripe 블로그 — Scaling your API with rate limiters',
      url: 'https://stripe.com/blog/rate-limiters',
    },
    {
      title: 'Cloudflare 블로그 — Counting things, a lot of different things',
      url: 'https://blog.cloudflare.com/counting-things-a-lot-of-different-things/',
    },
    {
      title: 'Redis 문서 — INCR',
      url: 'https://redis.io/docs/latest/commands/incr/',
    },
    {
      title: 'Redis 문서 — Rate limiter 패턴',
      url: 'https://redis.io/docs/latest/develop/use-cases/rate-limiter/',
    },
    {
      title: 'MDN — Retry-After 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
