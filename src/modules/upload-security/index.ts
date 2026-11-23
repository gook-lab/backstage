import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'upload-security',
  track: 'cases',
  order: 69,
  title: '업로드 파일 검증 — 형식 · 크기 · 내용을 서버에서 확인하기',
  question: '`accept`로 이미지만 고르게 했는데, 서버에서도 또 검사해야 하나요?',
  summary:
    '`accept`와 확장자, Content-Type은 모두 클라이언트가 정하는 값이라 서버가 그대로 믿으면 안 돼요. 첫 바이트로 형식을 확인하는 법과 그 한계, 허용 목록, 디코딩 전 크기 한도, 다른 도메인에서 서빙하는 방식을 정리해요.',
  minutes: 22,
  tags: ['보안', '업로드', 'HTTP', '입력 검증'],
  checklist: [
    {
      id: 'client-values',
      text: '`accept`, 확장자, Content-Type이 클라이언트가 정한 값이라 서버 판정 근거가 될 수 없다는 것을 설명할 수 있어요.',
    },
    {
      id: 'magic-number-limit',
      text: '첫 바이트로 PNG와 JPEG를 가릴 수 있고, 그 검사가 첫 바이트 뒤의 내용을 보지 않는다는 한계를 말할 수 있어요.',
    },
    {
      id: 'allowlist',
      text: '허용 목록 방식이 차단 목록보다 기본으로 나은 이유를 설명할 수 있어요.',
    },
    {
      id: 'decode-limit',
      text: '가로 · 세로 곱으로 디코딩 메모리를 계산하고, 디코딩 전에 한도를 두어야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'serve-separately',
      text: '업로드 파일을 다른 도메인에서 내려주고 nosniff를 붙이는 이유를 설명할 수 있어요.',
    },
    {
      id: 'svg-html-scripts',
      text: 'SVG와 HTML이 스크립트를 담을 수 있어서 이미지 업로드 허용 목록에서 빼는 편이 좋은 이유를 설명할 수 있어요.',
    },
    {
      id: 'reencode-metadata',
      text: '재인코딩으로 위치 정보(EXIF GPS)와 덧붙은 내용을 줄이고, 검사 뒤에 공개하는 흐름을 그릴 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — File Upload Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html',
    },
    {
      title: 'MDN — <input type="file"> 의 accept 속성',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file',
    },
    {
      title: 'MDN — Content-Type 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type',
    },
    {
      title: 'MDN — X-Content-Type-Options 헤더 (nosniff)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options',
    },
    {
      title: 'MDN — Content-Disposition 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition',
    },
    {
      title: 'MDN — SVG <script> 요소',
      url: 'https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script',
    },
    {
      title: 'WHATWG — MIME Sniffing 표준 (이미지 시그니처 · 스크립트 가능 MIME 타입)',
      url: 'https://mimesniff.spec.whatwg.org/',
    },
    {
      title: 'RFC 6266 — Content-Disposition 헤더 (filename 경로 조각)',
      url: 'https://www.rfc-editor.org/rfc/rfc6266',
    },
    {
      title: 'Library of Congress — Exif Version 2.x (파일 형식 설명)',
      url: 'https://www.loc.gov/preservation/digital/formats/fdd/fdd000146.shtml',
    },
    {
      title: 'ExifTool — GPS 태그 목록 (GPSLatitude · GPSLongitude)',
      url: 'https://exiftool.org/TagNames/GPS.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
