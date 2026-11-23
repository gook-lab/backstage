import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'deploy-version-skew',
  track: 'cases',
  order: 81,
  title: '배포 버전 차이 · 옛 탭 대응',
  question: '배포 직후 일부 사용자 화면에서만 청크 로드 오류가 나는 이유는 뭘까요?',
  summary:
    '배포 중에는 옛 버전과 새 버전이 같은 시간에 떠 있어요. 열린 탭은 배포 전 번들을 계속 쓰고, 옛 해시 파일은 새 배포에서 사라질 수 있어요. 전환 방식, 옛 자산 보존, 버전 헤더 감지를 나눠서 정리해요.',
  minutes: 20,
  tags: ['배포', 'API 설계', '캐시', 'FE 운영'],
  checklist: [
    {
      id: 'mixed-instances',
      text: '롤링 배포 중 같은 사용자의 요청이 옛 서버와 새 서버에 나뉘어 갈 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'open-tab',
      text: '배포 전에 받은 번들이 새 API를 부를 수 있다는 것을 알고, 그 탭을 다루는 방법을 말할 수 있어요.',
    },
    {
      id: 'expand-contract',
      text: '필드 삭제를 확장 · 이전 · 축소 순서로 나누는 이유를 설명할 수 있어요.',
    },
    {
      id: 'chunk-404',
      text: '배포 뒤 해시 붙은 청크가 404가 되는 원인과 옛 자산을 남기는 이유를 말할 수 있어요.',
    },
    {
      id: 'strategy-diff',
      text: '블루-그린과 카나리가 전환하고 롤백하는 방식의 차이를 설명할 수 있어요.',
    },
    {
      id: 'version-header',
      text: '버전 헤더로 클라이언트 버전 차이를 감지해 새로고침을 안내하는 흐름을 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Kubernetes — Deployment (RollingUpdate, maxUnavailable · maxSurge 기본값 25%)',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    },
    {
      title: 'Kubernetes — Liveness, Readiness, Startup Probes (readiness 실패 시 EndpointSlice에서 제거)',
      url: 'https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/',
    },
    {
      title: 'Kubernetes — Pod Lifecycle (Pod 종료, SIGTERM과 유예 기간)',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/',
    },
    {
      title: 'Vite — Building for Production (vite:preloadError 이벤트, 해시 붙은 자산)',
      url: 'https://vite.dev/guide/build',
    },
    {
      title: 'Vite — Build Options (build.assetsDir 기본값 assets)',
      url: 'https://vite.dev/config/build-options',
    },
    {
      title: 'MDN — Cache-Control (immutable)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control',
    },
    {
      title: 'Martin Fowler — Blue Green Deployment',
      url: 'https://martinfowler.com/bliki/BlueGreenDeployment.html',
    },
    {
      title: 'Martin Fowler — Canary Release',
      url: 'https://martinfowler.com/bliki/CanaryRelease.html',
    },
    {
      title: 'Vercel — Skew Protection',
      url: 'https://vercel.com/docs/skew-protection',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
