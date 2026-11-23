import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'load-balancing',
  track: 'cases',
  order: 36,
  title: '로드밸런서와 서버 교체 — 배포 중 요청이 가는 곳',
  question: '배포할 때마다 몇 초 동안 502가 나고 웹소켓이 끊기는 이유는 뭘까요?',
  summary:
    '로드밸런서는 헬스 체크로 정한 목록에만 요청을 보내요. 서버가 목록에서 빠지는 시각과 실제로 내려가는 시각이 다르면 그 사이에 실패가 생겨요. 헬스 체크, 드레이닝, 종료 순서를 나눠 보고 502 · 503 · 504가 어느 단계에서 나는지 정리해요.',
  minutes: 22,
  tags: ['로드밸런서', '배포', '헬스 체크', '웹소켓'],
  checklist: [
    {
      id: 'liveness-readiness',
      text: 'liveness는 재시작 신호, readiness는 트래픽 제외 신호라는 차이를 설명할 수 있어요.',
    },
    {
      id: 'deregistration-timing',
      text: '로드밸런서가 서버를 목록에서 빼는 시각과 프로세스가 내려가는 시각이 다를 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'drain-and-grace',
      text: '드레이닝 시간과 종료 대기 시간 중 짧은 쪽에서 처리 중 요청이 끊긴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'status-stage',
      text: '502, 503, 504가 로드밸런서와 대상 서버의 어느 단계에서 나는지 구분할 수 있어요.',
    },
    {
      id: 'mixed-versions',
      text: '롤링 배포 중 옛 버전과 새 버전 서버가 같은 시간에 응답하고, 같은 클라이언트도 다른 버전을 만날 수 있다는 것을 알아요.',
    },
    {
      id: 'long-connection-reconnect',
      text: 'SSE의 재연결과 WebSocket의 close 코드 1001을 받았을 때 화면이 할 일을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'AWS Elastic Load Balancing — 대상 그룹 (등록 해제 · 드레이닝 · 스티키 세션)',
      url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html',
    },
    {
      title: 'AWS Elastic Load Balancing — 대상 그룹 헬스 체크 (간격 · 연속 실패 횟수)',
      url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html',
    },
    {
      title: 'AWS Elastic Load Balancing — ALB 문제 해결 (HTTP 502 · 503 · 504 원인)',
      url: 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html',
    },
    {
      title: 'Kubernetes 문서 — 프로브 (liveness · readiness)',
      url: 'https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/',
    },
    {
      title: 'Kubernetes 문서 — Pod 종료 (SIGTERM · 유예 시간 · EndpointSlice)',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/',
    },
    {
      title: 'Kubernetes 문서 — Deployment 롤링 업데이트 (maxSurge 기본값)',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (502 · 503 · 504, Retry-After, 멱등 메서드 재시도)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'RFC 6455 — The WebSocket Protocol (닫기 코드 1001)',
      url: 'https://www.rfc-editor.org/rfc/rfc6455',
    },
    {
      title: 'MDN — Server-sent events 사용 (retry 필드)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events',
    },
    {
      title: 'WHATWG HTML — Server-sent events (재연결과 Last-Event-ID 헤더)',
      url: 'https://html.spec.whatwg.org/multipage/server-sent-events.html',
    },
    {
      title: 'MDN — WebSocket close 이벤트',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
