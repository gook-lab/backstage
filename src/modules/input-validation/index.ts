import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'input-validation',
  track: 'cases',
  order: 35,
  title: '입력 검증 — 화면과 서버의 책임',
  question: '폼에서 이미 검사하는데, 서버도 같은 검사를 또 해야 하나요? 에러 메시지는 어떻게 맞추나요?',
  summary:
    '화면 검사는 입력을 빨리 알려 주는 용도이고, 서버 검사가 저장되는 값을 정하는 신뢰 경계예요. 길이를 세는 단위와 정규화, 공백 처리를 양쪽이 같이 정해야 같은 입력에 같은 답이 나와요.',
  minutes: 20,
  tags: ['API 설계', '보안', '입력 검증'],
  checklist: [
    {
      id: 'split-roles',
      text: '화면 검증과 서버 검증이 각각 맡는 일을 구분해서 설명할 수 있어요.',
    },
    {
      id: 'allowlist',
      text: '허용 목록으로 형식 · 범위 · 길이를 적고, 그 밖의 값을 거절할 수 있어요.',
    },
    {
      id: 'length-unit',
      text: '길이를 UTF-16 코드 유닛, 코드 포인트, UTF-8 바이트 중 무엇으로 셀지 고를 수 있어요.',
    },
    {
      id: 'normalize-trim',
      text: '저장 전에 정규화와 공백 처리를 한 번 적용하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'field-error',
      text: '실패한 칸을 경로로 가리키는 오류 응답을 설계할 수 있어요.',
    },
    {
      id: 'server-only',
      text: '중복이나 재고처럼 서버만 아는 검증을 화면에 어떻게 알려 줄지 고를 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — Input Validation Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
    },
    {
      title: 'MDN — 제약 검증 (Constraint validation)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation',
    },
    {
      title: 'MDN — input 요소 maxlength (UTF-16 코드 유닛)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input',
    },
    {
      title: 'MDN — String.length',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length',
    },
    {
      title: 'MDN — 코드 포인트 (Code point)',
      url: 'https://developer.mozilla.org/en-US/docs/Glossary/Code_point',
    },
    {
      title: 'MDN — String.prototype.normalize()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize',
    },
    {
      title: 'MDN — String.prototype.trim()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim',
    },
    {
      title: 'MDN — Intl.Segmenter',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter',
    },
    {
      title: 'Unicode UAX #15 — Unicode Normalization Forms',
      url: 'https://unicode.org/reports/tr15/',
    },
    {
      title: 'RFC 3629 — UTF-8 (1~4 옥텟)',
      url: 'https://www.rfc-editor.org/rfc/rfc3629.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (400 · 409 · 422)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'MDN — 422 Unprocessable Content',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
