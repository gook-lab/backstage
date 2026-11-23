import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'image-cdn',
  track: 'cases',
  order: 13,
  title: '이미지와 CDN',
  question: '원본 이미지를 그대로 내려받아 CSS 로 줄여 보여 줘도 될까요?',
  summary:
    '화면에 맞는 크기와 형식의 변형을 만들고, srcset · sizes 로 브라우저가 고르게 해요. 캐시 키에 무엇을 넣어야 잘못된 파일이 나오지 않는지, 해시 파일 이름과 immutable 로 얼마나 길게 캐시할지, 무효화와 원본 요청이 어떤 비용을 만드는지 함께 봐요.',
  minutes: 25,
  tags: ['캐시', '성능', 'HTTP', '이미지'],
  checklist: [
    {
      id: 'srcset-choice',
      text: '원본 대신 화면 너비와 DPR 에 맞는 변형을 srcset · sizes 로 알려 주면 브라우저가 파일을 고르는 과정을 설명할 수 있어요.',
    },
    {
      id: 'format-negotiate',
      text: 'AVIF · WebP 를 쓸 때 지원하지 않는 기기에 어떤 형식을 줄지 Accept 협상과 폴백으로 설명할 수 있어요.',
    },
    {
      id: 'cache-key',
      text: '캐시 키에 크기나 형식이 빠지면 다른 파일이 나올 수 있는 이유를 설명할 수 있어요.',
    },
    {
      id: 'vary',
      text: 'Vary 헤더가 캐시가 요청 헤더별로 응답을 나누게 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'immutable',
      text: '파일 이름에 내용 해시를 넣을 때만 immutable 로 길게 캐시해도 안전한 이유를 말할 수 있어요.',
    },
    {
      id: 'origin-load',
      text: '적중률과 원본 요청 수가 어떤 관계인지, 무효화 대상 수가 어떻게 늘어나는지 설명할 수 있어요.',
    },
    {
      id: 'lcp-loading',
      text: 'LCP 이미지에 lazy 를 쓰면 안 되는 이유와 fetchpriority 를 쓸 자리를 고를 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — Responsive images',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images',
    },
    {
      title: 'MDN — <picture> element',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture',
    },
    {
      title: 'MDN — Image file type and format guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types',
    },
    {
      title: 'MDN — <img> element (loading, fetchpriority)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img',
    },
    {
      title: 'MDN — Cache-Control',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control',
    },
    {
      title: 'MDN — Vary',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
    },
    {
      title: 'MDN — HTTP caching',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
    },
    {
      title: 'MDN — Content negotiation',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation',
    },
    {
      title: 'RFC 9111 — HTTP Caching (4.1 Vary 로 캐시 키 계산)',
      url: 'https://www.rfc-editor.org/rfc/rfc9111.html',
    },
    {
      title: 'web.dev — Optimize Largest Contentful Paint',
      url: 'https://web.dev/articles/optimize-lcp',
    },
    {
      title: 'web.dev — Browser-level image lazy loading',
      url: 'https://web.dev/articles/browser-level-image-lazy-loading',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
