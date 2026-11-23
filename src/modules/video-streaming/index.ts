import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'video-streaming',
  track: 'cases',
  order: 52,
  title: '동영상 재생 — 트랜스코딩과 적응형 스트리밍',
  question:
    '올린 mp4를 video 태그로 바로 틀었더니 모바일에서 시작이 느리고 자꾸 멈춰요. 서버는 동영상을 어떻게 준비하나요?',
  summary:
    '원본 파일을 그대로 내려주면 기기와 네트워크에 따라 멈추기 쉬워요. 트랜스코딩으로 여러 화질을 만들고, 세그먼트 재생 목록을 따라 연결에 맞춰 화질을 바꾸는 방식을 정리해요.',
  minutes: 20,
  tags: ['미디어', 'HTTP', 'CDN', '스트리밍'],
  checklist: [
    {
      id: 'range-206',
      text: 'Range 요청과 206 응답으로 원본 파일의 일부만 받을 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'renditions',
      text: '트랜스코딩으로 같은 영상을 여러 화질과 비트레이트로 만드는 이유를 설명할 수 있어요.',
    },
    {
      id: 'playlist-segments',
      text: 'HLS의 마스터 · 미디어 재생 목록과 DASH의 MPD가 세그먼트를 어떻게 가리키는지 설명할 수 있어요.',
    },
    {
      id: 'abr-buffer',
      text: '적응형 플레이어가 버퍼와 측정한 처리량을 함께 보고 화질을 고른다는 것을 설명할 수 있어요.',
    },
    {
      id: 'processing-state',
      text: '업로드 뒤 처리 중 상태를 화면에 보여 주고, 완료 전에는 재생 주소를 열어 두지 않는 흐름을 설계할 수 있어요.',
    },
    {
      id: 'cdn-signed',
      text: '세그먼트를 CDN에서 캐시하고, 서명 URL의 만료 시각으로 접근을 제한하는 방법을 알아요.',
    },
  ],
  sources: [
    {
      title: 'RFC 8216 — HTTP Live Streaming (Master · Media Playlist, EXT-X-STREAM-INF, EXT-X-TARGETDURATION)',
      url: 'https://www.rfc-editor.org/rfc/rfc8216',
    },
    {
      title: 'Apple — HLS 저작 명세 (HTTP Live Streaming authoring spec for Apple devices)',
      url: 'https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (14.2 Range, 14.3 Accept-Ranges, 15.3.7 206, 15.5.17 416)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'MDN — Range 요청 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range',
    },
    {
      title: 'MDN — Range 요청 가이드 (Range requests)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests',
    },
    {
      title: 'MDN — video 요소 (poster · preload)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video',
    },
    {
      title: 'MDN — HTMLMediaElement (readyState · buffered · waiting · stalled)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement',
    },
    {
      title: 'MDN — Media Source Extensions API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API',
    },
    {
      title: 'DASH-IF 상호운용성 지침 V5 (MPEG DASH ISO/IEC 23009-1 기반)',
      url: 'https://dash-industry-forum.github.io/guidelines/iop-v5/',
    },
    {
      title: 'Amazon CloudFront — 서명 URL 사용 (expiration date and time)',
      url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html',
    },
    {
      title: 'Amazon CloudFront — Range GET 요청 처리 방식',
      url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
