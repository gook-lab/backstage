import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'cors',
  track: 'cases',
  order: 26,
  title: 'CORS와 교차 출처 요청',
  question: '로컬에서는 되는데 배포하니 "blocked by CORS policy"가 떠요. 서버는 요청을 받긴 한 걸까요?',
  summary:
    'CORS는 서버가 브라우저에게 다른 출처의 응답을 읽어도 된다고 알려 주는 장치예요. 요청을 막는 방화벽이 아니라서 단순 요청은 서버에 도달하고, 브라우저가 응답 읽기만 막아요. 프리플라이트, 자격 증명, 허락 헤더를 판정 규칙대로 따라가 봐요.',
  minutes: 20,
  tags: ['보안', 'API 설계', '캐시'],
  checklist: [
    {
      id: 'origin-definition',
      text: '출처를 스킴, 호스트, 포트 세 가지로 나눠서 같은 출처인지 판단할 수 있어요.',
    },
    {
      id: 'cors-is-read-gate',
      text: 'CORS 실패가 요청을 막은 것인지, 응답 읽기를 막은 것인지 구분할 수 있어요.',
    },
    {
      id: 'preflight-trigger',
      text: '어떤 메서드와 헤더가 프리플라이트를 부르는지 말할 수 있어요.',
    },
    {
      id: 'credentials-rules',
      text: '자격 증명을 보낼 때 Allow-Origin에 * 를 쓸 수 없는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-debug-steps',
      text: '콘솔 문구와 네트워크 탭의 OPTIONS 행으로 실패 지점을 찾을 수 있어요.',
    },
    {
      id: 'expose-headers',
      text: '응답 헤더를 JS에서 읽으려면 Access-Control-Expose-Headers를 써야 하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — Cross-Origin Resource Sharing (CORS)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS',
    },
    {
      title: 'MDN — Same-origin policy',
      url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy',
    },
    {
      title: 'WHATWG Fetch Standard — CORS-preflight fetch, CORS check, CORS-safelisted response-header names',
      url: 'https://fetch.spec.whatwg.org/',
    },
    {
      title: 'MDN — Access-Control-Allow-Origin',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin',
    },
    {
      title: 'MDN — Access-Control-Allow-Headers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Headers',
    },
    {
      title: 'MDN — Access-Control-Expose-Headers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers',
    },
    {
      title: 'MDN — Access-Control-Max-Age',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age',
    },
    {
      title: 'MDN — Access-Control-Allow-Credentials',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials',
    },
    {
      title: 'MDN — Vary',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
