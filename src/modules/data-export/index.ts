import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'data-export',
  track: 'cases',
  order: 59,
  title: '대용량 내보내기 — 스트리밍과 비동기 파일 생성 고르기',
  question: '관리자 화면에서 엑셀 다운로드가 30초 뒤 타임아웃이 나요. 10만 건은 서버에서 어떻게 내보내야 하나요?',
  summary:
    '요청 하나가 행을 전부 모은 뒤에야 응답하면 행 수만큼 시간과 메모리가 들어요. 이 글은 응답을 바로 흘려보내는 스트리밍과, 파일을 따로 만들고 만료되는 링크로 내려받는 비동기 방식을 비교해요. CSV 형식 규칙, 엑셀 한글 깨짐, 수식 주입, 내보내기 시점의 일관성, 권한과 감사 기록까지 정리해요.',
  minutes: 22,
  tags: ['HTTP', 'DB', 'CSV', '스트리밍', '보안'],
  checklist: [
    {
      id: 'memory-limit',
      text: '행을 전부 모아 응답하는 방식이 첫 바이트를 늦추고 서버 메모리를 행 수만큼 쓰는 이유를 설명할 수 있어요.',
    },
    {
      id: 'stream-pick',
      text: '커서나 COPY로 행을 나눠 읽고 조각마다 응답에 쓰는 스트리밍 흐름을 그릴 수 있어요.',
    },
    {
      id: 'async-link',
      text: '비동기로 파일을 만들고, 만료 시간이 있는 다운로드 링크로 내려받게 하는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'csv-escape',
      text: 'RFC 4180에 따라 쉼표, 줄바꿈, 큰따옴표가 든 필드를 감싸고 이스케이프할 수 있어요.',
    },
    {
      id: 'formula-guard',
      text: '셀이 =, +, -, @ 로 시작하면 수식 주입 위험이 있다는 것과, 그 대응이 엑셀에서 어떻게 달라지는지 설명할 수 있어요.',
    },
    {
      id: 'snapshot-scope',
      text: '페이지를 나눠 받을 때 생기는 중복과 누락을 떠올리고, 같은 시점의 데이터를 받는 방법을 고를 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 4180 — CSV 형식 (CRLF, 큰따옴표 이스케이프, text/csv)',
      url: 'https://www.rfc-editor.org/rfc/rfc4180',
    },
    {
      title: 'RFC 6266 — Content-Disposition 헤더 (attachment, filename*)',
      url: 'https://www.rfc-editor.org/rfc/rfc6266',
    },
    {
      title: 'RFC 8187 — 헤더 파라미터의 UTF-8 인코딩 (ext-value)',
      url: 'https://www.rfc-editor.org/rfc/rfc8187',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (202 Accepted, 504 Gateway Timeout)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'MDN — Content-Disposition 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition',
    },
    {
      title: 'MDN — Streams API (내장 역압과 큐)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Streams_API',
    },
    {
      title: 'MDN — Streams API 개념 (역압 설명)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts',
    },
    {
      title: 'OWASP — CSV Injection',
      url: 'https://owasp.org/www-community/attacks/CSV_Injection',
    },
    {
      title: 'PostgreSQL 문서 — DECLARE (WITH HOLD, 트랜잭션 안에서만 쓰는 커서)',
      url: 'https://www.postgresql.org/docs/current/sql-declare.html',
    },
    {
      title: 'PostgreSQL 문서 — COPY (COPY TO STDOUT, SELECT 결과 복사)',
      url: 'https://www.postgresql.org/docs/current/sql-copy.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 격리 (REPEATABLE READ 스냅샷)',
      url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
    },
    {
      title: 'AWS S3 문서 — presigned URL 만료 시간과 자격 증명',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html',
    },
    {
      title: 'Unicode FAQ — UTF-8, UTF-16, UTF-32 & BOM',
      url: 'https://www.unicode.org/faq/utf_bom.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
