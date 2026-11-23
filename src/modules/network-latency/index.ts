import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'network-latency',
  track: 'cases',
  order: 43,
  title: '거리와 왕복 지연',
  question: '해외 사용자만 첫 화면이 3초 넘게 걸리는데, 서버를 더 빠르게 하면 해결되나요?',
  summary:
    '서버 처리 시간을 줄여도 빛의 속도가 정한 왕복 시간은 남아요. 연결을 새로 맺는 핸드셰이크 왕복, 직렬로 보내는 요청 수, CDN 엣지와 오리진 거리를 나눠서 첫 화면까지 몇 번 왕복하는지 셀 수 있게 해요.',
  minutes: 25,
  tags: ['네트워크', '성능', 'HTTP', 'CDN'],
  checklist: [
    {
      id: 'rtt-floor',
      text: '거리와 빛의 속도 때문에 왕복 시간에 하한이 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'setup-count',
      text: 'TCP · TLS · QUIC 연결을 새로 맺을 때 프로토콜마다 왕복이 몇 번 더 드는지 말할 수 있어요.',
    },
    {
      id: 'waterfall',
      text: '앞 응답을 기다리는 요청 수에 RTT를 곱해 첫 화면 시간을 계산할 수 있어요.',
    },
    {
      id: 'reuse',
      text: '연결 재사용과 세션 재개가 왜 왕복을 줄이는지 설명할 수 있어요.',
    },
    {
      id: 'edge-miss',
      text: '엣지 적중과 미스가 첫 응답 시간을 어떻게 바꾸는지 설명할 수 있어요.',
    },
    {
      id: 'hints',
      text: 'preconnect와 dns-prefetch를 쓸 출처와 쓰지 말아야 할 경우를 고를 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'HPBN — Primer on Latency and Bandwidth (빛의 속도 · RTT 예시)',
      url: 'https://hpbn.co/primer-on-latency-and-bandwidth/',
    },
    {
      title: 'HPBN — Building Blocks of TCP (3-way 핸드셰이크 · 연결 재사용)',
      url: 'https://hpbn.co/building-blocks-of-tcp/',
    },
    {
      title: 'HPBN — Transport Layer Security (TLS) (전체 · 재개 핸드셰이크 왕복)',
      url: 'https://hpbn.co/transport-layer-security-tls/',
    },
    {
      title: 'RFC 8446 — TLS 1.3 (2 Handshake Protocol, 2.3 0-RTT Data)',
      url: 'https://www.rfc-editor.org/rfc/rfc8446.html',
    },
    {
      title: 'RFC 9000 — QUIC (결합 핸드셰이크 · 0-RTT · 스트림별 HOL 회피)',
      url: 'https://www.rfc-editor.org/rfc/rfc9000.html',
    },
    {
      title: 'RFC 9113 — HTTP/2 (5 Streams and Multiplexing · 9.1.1 Connection Reuse)',
      url: 'https://www.rfc-editor.org/rfc/rfc9113.html',
    },
    {
      title: 'RFC 9114 — HTTP/3 (3.2 Connection Establishment · 3.3 Connection Reuse)',
      url: 'https://www.rfc-editor.org/rfc/rfc9114.html',
    },
    {
      title: 'MDN — rel="preconnect" HTML attribute value',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect',
    },
    {
      title: 'MDN — rel="dns-prefetch" HTML attribute value',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/dns-prefetch',
    },
    {
      title: 'web.dev — Establish network connections early to improve perceived page speed',
      url: 'https://web.dev/articles/preconnect-and-dns-prefetch',
    },
    {
      title: 'AWS — Amazon CloudFront 소개 (엣지 위치 · 캐시 미스 시 오리진 요청)',
      url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html',
    },
    {
      title: 'AWS — Regions and Availability Zones (리전 격리 · 리전 간 자동 복제 없음)',
      url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
