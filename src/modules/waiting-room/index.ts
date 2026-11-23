import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'waiting-room',
  track: 'cases',
  order: 4,
  title: '가상 대기실 · 처리량 제한',
  question: '티켓 오픈 때 "대기 순번 3,201번"은 어떻게 동작하나요?',
  summary:
    '예매 서버가 감당할 수 있는 양은 정해져 있어요. 대기실은 순번을 주고 일정한 속도로만 들여보내고, 요청 제한은 요청이 몰리는 모양을 시간 창으로 잘라 막아요. 실패가 나면 Retry-After 와 jitter 로 재시도를 흩어 놓아요.',
  minutes: 16,
  tags: ['API 설계', 'HTTP', '동시성'],
  checklist: [
    {
      id: 'retry-storm',
      text: '실패한 요청이 같은 시각에 다시 몰리면 처리 능력을 넘는 부하가 되는 이유를 설명할 수 있어요.',
    },
    {
      id: 'admit-rate',
      text: '대기실 입장 속도 R 을 BE 처리 능력 C 이하로 잡아야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'position-vs-eta',
      text: '순번은 서버가 아는 사실이고 예상 대기 시간은 추정이라는 점을 구분해 화면에 보여 줄 수 있어요.',
    },
    {
      id: 'window-edge',
      text: '고정 창의 경계에서 한도의 두 배가 통과하는 이유를 설명하고, 슬라이딩 방식과 비교할 수 있어요.',
    },
    {
      id: 'status-codes',
      text: '429 와 503 을 구분하고, Retry-After 를 따라 다음 요청 시각을 정할 수 있어요.',
    },
    {
      id: 'jitter',
      text: '재시도 간격에 jitter 를 넣는 이유를 설명하고, 지수 백오프와 함께 구현할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (429 Too Many Requests)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (10.2.3 Retry-After, 15.6.4 503 Service Unavailable)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'IETF Internet-Draft — RateLimit header fields for HTTP (draft-ietf-httpapi-ratelimit-headers)',
      url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/',
    },
    {
      title: 'AWS Architecture Blog — Exponential Backoff And Jitter',
      url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
    },
    {
      title: 'Cloudflare Waiting Room 문서 — 개요',
      url: 'https://developers.cloudflare.com/waiting-room/',
    },
    {
      title: 'Cloudflare Waiting Room 문서 — Configuration settings',
      url: 'https://developers.cloudflare.com/waiting-room/reference/configuration-settings/',
    },
    {
      title: 'Amazon API Gateway 개발자 가이드 — Throttle requests to your REST APIs',
      url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
