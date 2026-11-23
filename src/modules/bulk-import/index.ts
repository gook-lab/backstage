import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'bulk-import',
  track: 'cases',
  order: 45,
  title: 'CSV 대량 가져오기 — 행별 오류와 부분 성공',
  question: '상품 1만 행 중 몇 행만 틀렸을 때, 어디가 틀렸는지 알려 주면서 나머지를 저장할 수 있나요?',
  summary:
    'CSV 한 파일에 행이 많으면 한 행의 오류가 전체 결과를 바꿔요. RFC 4180 형식과 인코딩 함정을 먼저 보고, 전체 롤백 · 행별 부분 성공 · 검증 후 확정을 비교해요.',
  minutes: 18,
  tags: ['CSV', '대량 처리', '멱등성', '오류 응답', '보안'],
  checklist: [
    {
      id: 'csv-shape',
      text: '큰따옴표, 쉼표, 줄바꿈이 들어간 칸이 RFC 4180에서 어떻게 감싸져야 하는지 설명할 수 있어요.',
    },
    {
      id: 'encoding-bom',
      text: '파일 인코딩과 BOM이 헤더 이름을 어떻게 틀리게 만드는지 설명할 수 있어요.',
    },
    {
      id: 'strategy-choice',
      text: '전체 롤백, 행별 부분 성공, 검증 후 확정이 저장되는 행과 보고되는 오류를 어떻게 바꾸는지 비교할 수 있어요.',
    },
    {
      id: 'row-error-shape',
      text: '행 번호, 열 이름, 이유를 담은 오류 목록으로 어느 칸을 고칠지 화면에 보여 줄 수 있어요.',
    },
    {
      id: 'reupload-key',
      text: '업서트 키를 정해 같은 파일을 다시 올려도 중복 행이 생기지 않게 만들 수 있어요.',
    },
    {
      id: 'export-injection',
      text: '내보내는 CSV의 수식으로 읽힐 수 있는 칸을 찾아 막는 방법을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 4180 — CSV 파일의 공통 형식과 MIME 타입',
      url: 'https://www.rfc-editor.org/rfc/rfc4180',
    },
    {
      title: 'PostgreSQL 문서 — COPY (ON_ERROR · ENCODING · CSV 형식)',
      url: 'https://www.postgresql.org/docs/current/sql-copy.html',
    },
    {
      title: 'PostgreSQL 문서 — INSERT (ON CONFLICT DO UPDATE)',
      url: 'https://www.postgresql.org/docs/current/sql-insert.html',
    },
    {
      title: 'PostgreSQL 문서 — 트랜잭션 기초 (BEGIN · COMMIT · ROLLBACK)',
      url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html',
    },
    {
      title: 'OWASP — CSV Injection',
      url: 'https://owasp.org/www-community/attacks/CSV_Injection',
    },
    {
      title: 'MDN — TextDecoder',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder',
    },
    {
      title: 'MDN — Blob: text() 메서드',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Blob/text',
    },
    {
      title: 'MDN — 웹 애플리케이션에서 파일 사용하기 (File API)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
