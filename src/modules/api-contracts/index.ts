import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'api-contracts',
  track: 'cases',
  order: 28,
  title: 'API 계약 — 스키마와 타입',
  question:
    'API 응답 타입을 손으로 적어 두었는데, 서버가 필드를 바꾸면 런타임에서야 깨져요. 계약을 어떻게 맞춰 둘 수 있을까요?',
  summary:
    'TypeScript 타입은 컴파일 때만 있고, 서버 응답은 실행 중에 도착해요. 그래서 명세를 원본으로 두고, 타입은 명세에서 만들고, 응답은 받은 자리에서 칸마다 검사하는 편이 좋아요. 이 글은 OpenAPI와 JSON Schema로 계약을 적는 방법, 하위 호환 규칙, 계약 테스트와 CI 검사를 다뤄요.',
  minutes: 22,
  tags: ['OpenAPI', 'JSON Schema', '타입 생성', '경계 파싱', '계약 테스트'],
  checklist: [
    {
      id: 'contract-spec',
      text: '경로, 필수 여부, 허용 값을 명세에 적어야 서버와 FE가 같은 약속을 보는 이유를 설명할 수 있어요.',
    },
    {
      id: 'ts-erasure',
      text: 'TypeScript 타입이 실행 중에 남지 않아서 as 단언이 서버 응답을 검사하지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'boundary-parse',
      text: '응답을 unknown으로 받아 경계에서 칸마다 검사하고, 어긋나면 화면 진입을 멈추는 흐름을 짤 수 있어요.',
    },
    {
      id: 'null-absent',
      text: 'null과 칸 없음이 JSON에서 다른 값이라 검사와 화면 처리도 달라야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'compat-rules',
      text: '필드 추가, 이름 변경, 타입 변경, enum 값 추가 중 어느 것이 옛 소비자를 깨는지 구분할 수 있어요.',
    },
    {
      id: 'contract-test',
      text: '소비자가 기대하는 응답을 계약으로 적고, 제공자가 그 계약을 검증하는 흐름을 설명할 수 있어요.',
    },
    {
      id: 'ci-diff',
      text: '명세의 두 버전을 CI에서 비교해 깨지는 변경을 PR에서 먼저 잡을 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OpenAPI Specification v3.1.1 (Paths Object · Components Object · 데이터 타입 목록)',
      url: 'https://spec.openapis.org/oas/v3.1.1.html',
    },
    {
      title: 'JSON Schema — Reference: Object (required · additionalProperties 기본값)',
      url: 'https://json-schema.org/understanding-json-schema/reference/object',
    },
    {
      title: 'JSON Schema — Reference: null (null과 칸 없음은 다르다는 설명)',
      url: 'https://json-schema.org/understanding-json-schema/reference/null',
    },
    {
      title: 'JSON Schema — Reference: Enumerated values (enum)',
      url: 'https://json-schema.org/understanding-json-schema/reference/enum',
    },
    {
      title: 'TypeScript Handbook — Everyday Types (Type Assertions는 컴파일 때 지워지고 런타임 검사가 없음)',
      url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
    },
    {
      title: 'RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format (값의 종류 목록, 숫자 정밀도)',
      url: 'https://www.rfc-editor.org/rfc/rfc8259',
    },
    {
      title: 'RFC 7493 — The I-JSON Message Format (정수 범위 2^53 기준)',
      url: 'https://www.rfc-editor.org/rfc/rfc7493',
    },
    {
      title: 'RFC 3339 — Date and Time on the Internet: Timestamps (date-time 문법)',
      url: 'https://www.rfc-editor.org/rfc/rfc3339',
    },
    {
      title: 'Pact 문서 — Introduction (코드 우선 소비자 주도 계약 테스트)',
      url: 'https://docs.pact.io/',
    },
    {
      title: 'openapi-typescript — README (OpenAPI 3 명세에서 TypeScript 타입 생성)',
      url: 'https://github.com/openapi-ts/openapi-typescript',
    },
    {
      title: 'oasdiff — README (OpenAPI Diff and Breaking Changes)',
      url: 'https://github.com/oasdiff/oasdiff',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
