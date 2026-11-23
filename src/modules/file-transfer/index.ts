import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'file-transfer',
  track: 'cases',
  order: 11,
  title: '파일 업로드와 대용량 다운로드',
  question: '1 GB 짜리 영상을 올릴 때 API 서버로 보내야 할까요, 저장소로 바로 보내야 할까요?',
  summary:
    'API 서버를 거치는 업로드가 왜 413과 메모리 부담을 만드는지 보고, presigned URL로 저장소에 직접 올리는 흐름과 멀티파트 업로드로 실패한 조각만 다시 보내는 법을 비교해요. 완료 확인을 서버에 알리는 순서, 다운로드의 Range 요청과 206으로 이어받기, Content-Disposition, 큰 응답을 스트리밍하는 방법까지 정리해요.',
  minutes: 16,
  tags: ['HTTP', 'S3', '업로드', '다운로드'],
  checklist: [
    {
      id: 'why-not-through-api',
      text: '큰 파일을 API 서버로 그대로 보내면 요청 크기 한도(413)와 서버 메모리 부담이 생긴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'presigned-flow',
      text: 'presigned URL이 대상 객체, HTTP 메서드, 만료 시간을 담고 있어서, 서버가 발급하고 FE가 저장소로 직접 보내는 흐름을 말할 수 있어요.',
    },
    {
      id: 'multipart-retry',
      text: '멀티파트 업로드에서 조각마다 ETag를 기록하고, 끊긴 조각만 다시 보내며, 완료 요청에 조각 번호와 ETag를 함께 보낸다는 것을 알아요.',
    },
    {
      id: 'complete-after-parts',
      text: '모든 조각이 끝난 뒤에만 서버에 완료를 알리고, 완료 전에는 파일을 ready로 표시하지 않는 순서를 설명할 수 있어요.',
    },
    {
      id: 'range-resume',
      text: 'Range 요청에 206과 Content-Range로 답하는 것을 알고, 서버가 Range를 무시해 200으로 전체를 줄 수 있다는 점을 이어받기 코드에 반영할 수 있어요.',
    },
    {
      id: 'download-headers',
      text: 'Content-Disposition의 attachment와 inline 차이, filename* 로 UTF-8 파일 이름을 주는 방식을 알아요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (413, 206, 416, Range)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'RFC 6266 — Content-Disposition 헤더 (attachment, filename*)',
      url: 'https://www.rfc-editor.org/rfc/rfc6266',
    },
    {
      title: 'MDN — 413 Content Too Large',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/413',
    },
    {
      title: 'MDN — 206 Partial Content',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/206',
    },
    {
      title: 'MDN — HTTP 범위 요청 (Range requests, Accept-Ranges)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests',
    },
    {
      title: 'MDN — Content-Disposition 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition',
    },
    {
      title: 'MDN — Streams API (청크 단위 처리, 역압)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Streams_API',
    },
    {
      title: 'AWS S3 문서 — 사전 서명된 URL (presigned URL)',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html',
    },
    {
      title: 'AWS S3 문서 — 멀티파트 업로드 개요',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html',
    },
    {
      title: 'AWS S3 문서 — 기능 및 제한 (조각 수 · 조각 크기)',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
