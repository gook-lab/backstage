import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'api-versioning',
  track: 'cases',
  order: 37,
  title: 'API 버전 · 폐기 — 옛 앱을 다루는 방법',
  question: '서버가 API를 바꾸면, 앱 심사 때문에 몇 주씩 남는 옛 앱은 어떻게 되나요?',
  summary:
    '웹은 배포하면 새 코드를 받지만, 앱은 사용자가 업데이트해야 새 코드를 받아요. 그래서 버전을 어디에 표시할지, 호환을 깨지 않는 변경을 어떻게 고를지, 폐기를 어떤 순서로 알리고 끌지를 나눠 봐요. 시뮬레이터에서는 날짜별로 어떤 클라이언트가 정상, 경고, 업데이트 화면, 차단을 받는지 봐요.',
  minutes: 16,
  tags: ['API 버전', '폐기 공지', 'Deprecation', 'Sunset', '강제 업데이트'],
  checklist: [
    {
      id: 'version-location',
      text: 'URL 경로, 헤더, 쿼리, 미디어 타입 중 버전을 어디에 둘지 측정하기 쉬운 기준으로 고를 수 있어요.',
    },
    {
      id: 'compatible-change',
      text: '칸 추가처럼 옛 클라이언트가 무시하는 변경은 버전을 올리지 않아도 되는 이유를 설명할 수 있어요.',
    },
    {
      id: 'deprecation-signal',
      text: 'Deprecation과 Sunset 헤더가 알림일 뿐 차단이 아니라는 점을 설명할 수 있어요.',
    },
    {
      id: 'usage-measure',
      text: '옛 버전 사용량을 세야 폐기 날짜를 정할 수 있는 이유를 설명할 수 있어요.',
    },
    {
      id: 'min-version-gate',
      text: '최소 지원 버전 응답으로 업데이트 화면을 띄우고, 앱을 열지 않은 기기는 따로 막히는 흐름을 설계할 수 있어요.',
    },
    {
      id: 'release-speed',
      text: '웹 FE와 모바일 앱의 배포 속도 차이가 옛 응답 처리 코드를 지울 시점에 주는 영향을 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9745 — The Deprecation HTTP Response Header Field',
      url: 'https://www.rfc-editor.org/rfc/rfc9745.html',
    },
    {
      title: 'RFC 8594 — The Sunset HTTP Header Field',
      url: 'https://www.rfc-editor.org/rfc/rfc8594.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (12.5.1 Accept, 12.5.5 Vary, 15.5.11 410 Gone, 15.5.22 426 Upgrade Required)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'Google AIP-185 — API Versioning',
      url: 'https://google.aip.dev/185',
    },
    {
      title: 'Microsoft Azure REST API Guidelines (API Versioning, Deprecating Behavior Notification)',
      url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md',
    },
    {
      title: 'Stripe — API versioning',
      url: 'https://docs.stripe.com/api/versioning',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
