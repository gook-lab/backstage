import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'realtime-delivery',
  track: 'cases',
  order: 8,
  title: '실시간 알림 — 폴링 · SSE · WebSocket',
  question: '채팅 · 알림 · 주문 상태는 어떤 방식으로 받아야 할까요?',
  summary:
    '서버가 먼저 말하려면 연결을 열어 둬야 해요. 짧은 폴링은 구현이 쉽지만 빈 응답이 쌓이고, SSE는 서버에서 클라이언트로 흐르는 알림에 맞아요. WebSocket은 양방향이 필요한 채팅에 맞아요. 재연결 때 놓친 이벤트를 어떻게 채우는지가 FE와 BE가 맞춰야 할 지점이에요.',
  minutes: 18,
  tags: ['실시간', 'HTTP', 'SSE', 'WebSocket', '네트워크'],
  checklist: [
    {
      id: 'polling-delay',
      text: '짧은 폴링의 평균 지연이 간격 P의 절반쯤이고, 이벤트가 드물면 빈 응답이 늘어나는 이유를 설명할 수 있어요.',
    },
    {
      id: 'direction',
      text: '알림처럼 서버에서 클라이언트로만 흐르면 SSE를, 채팅처럼 양쪽에서 보내면 WebSocket을 고르는 이유를 말할 수 있어요.',
    },
    {
      id: 'connection-cost',
      text: '연결 하나가 서버의 메모리와 파일 디스크립터를 차지하고, 프록시의 유휴 시간 제한이 그 연결을 끊을 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'backplane',
      text: '서버가 여러 대일 때 이벤트를 받은 서버가 아니라 연결을 쥔 서버로 전달하려면 pub/sub이 필요하다는 것을 설명할 수 있어요.',
    },
    {
      id: 'resume',
      text: '재연결 때 Last-Event-ID나 커서로 빈 구간을 채우거나 상태를 다시 조회해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'dedupe',
      text: '같은 이벤트가 두 번 와도 id로 한 번만 반영하도록 짤 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'WHATWG HTML Living Standard — 9.2 Server-sent events',
      url: 'https://html.spec.whatwg.org/multipage/server-sent-events.html',
    },
    {
      title: 'MDN — EventSource',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/EventSource',
    },
    {
      title: 'MDN — Using server-sent events',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events',
    },
    {
      title: 'MDN — WebSocket API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket',
    },
    {
      title: 'RFC 6455 — The WebSocket Protocol',
      url: 'https://www.rfc-editor.org/rfc/rfc6455.html',
    },
    {
      title: 'MDN — Push API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',
    },
    {
      title: 'MDN — WebTransport API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API',
    },
    {
      title: 'MDN — Page Visibility API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API',
    },
    {
      title: 'Redis 문서 — Pub/Sub',
      url: 'https://redis.io/docs/latest/develop/pubsub/',
    },
    {
      title: 'nginx 문서 — ngx_http_proxy_module',
      url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
