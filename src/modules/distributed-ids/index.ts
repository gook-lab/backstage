import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'distributed-ids',
  track: 'cases',
  order: 16,
  title: 'ID 설계 — 자동 증가와 UUID',
  question: '주문 번호가 1, 2, 3 으로 늘면 안 되나요? 화면에서 임시 ID 를 만들어도 될까요?',
  summary:
    '자동 증가 번호는 빈 번호를 남기고 추측하기 쉬워요. UUID v4 는 무작위라 인덱스 삽입을 흩뜨리고, v7 은 시간 순이에요. 64비트 정수는 JS Number 로 받으면 값이 깨지니 문자열로 받아요. 화면에서 만든 UUID 는 임시 ID 와 멱등 키로 함께 쓸 수 있어요.',
  minutes: 22,
  tags: ['DB', 'ID', 'UUID', 'API', '인덱스'],
  checklist: [
    {
      id: 'sequence-gaps',
      text: '자동 증가 번호가 롤백돼도 되돌아가지 않아 빈 번호가 생긴다는 것과, 빈 번호 없는 번호가 필요하면 시퀀스가 맞지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'guessable-not-authz',
      text: '연속 ID 는 추측을 쉽게 만들고, 무작위 ID 로 바꾸더라도 소유자 검사가 없으면 남의 리소스가 열린다는 것을 설명할 수 있어요.',
    },
    {
      id: 'uuid-version',
      text: 'UUID v4 는 무작위, v7 은 시간 순이라는 차이를 알고, 인덱스 삽입 위치가 어떻게 달라지는지 말할 수 있어요.',
    },
    {
      id: 'int64-as-string',
      text: '2의 53제곱을 넘는 정수 ID 를 JSON 숫자로 받으면 값이 바뀔 수 있어서, 응답에서 ID 를 문자열로 주는 계약을 세울 수 있어요.',
    },
    {
      id: 'client-generated-id',
      text: '클라이언트가 만든 UUID 를 임시 ID 로 화면에 쓰고, 같은 값을 멱등 키로 보내 재시도가 중복 생성을 막게 하는 흐름을 설계할 수 있어요.',
    },
    {
      id: 'time-ordered-cursor',
      text: '시간 순 ID 를 커서 페이지네이션의 정렬 키로 쓸 수 있고, 같은 밀리초 안의 순서 문제를 어떻게 다룰지 정할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 시퀀스 함수 (nextval 은 롤백돼도 되돌리지 않아요)',
      url: 'https://www.postgresql.org/docs/current/functions-sequence.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE SEQUENCE (빈 번호 없는 할당에는 쓸 수 없어요)',
      url: 'https://www.postgresql.org/docs/current/sql-createsequence.html',
    },
    {
      title: 'PostgreSQL 문서 — 아이덴티티 열 (GENERATED AS IDENTITY)',
      url: 'https://www.postgresql.org/docs/current/ddl-identity-columns.html',
    },
    {
      title: 'PostgreSQL 문서 — 숫자 자료형 (bigint 범위, serial 의 빈 번호)',
      url: 'https://www.postgresql.org/docs/current/datatype-numeric.html',
    },
    {
      title: 'PostgreSQL 문서 — UUID 생성 함수 (uuidv4 · uuidv7, 시간 순 UUID)',
      url: 'https://www.postgresql.org/docs/current/functions-uuid.html',
    },
    {
      title: 'RFC 9562 — UUID (v4 인덱스 지역성, v7 구조, §6.2 단조성 카운터)',
      url: 'https://www.rfc-editor.org/rfc/rfc9562',
    },
    {
      title: 'RFC 8259 — JSON (정수 [-(2^53)+1, (2^53)-1] 의 상호 운용성)',
      url: 'https://www.rfc-editor.org/rfc/rfc8259',
    },
    {
      title: 'OWASP — IDOR 방지 치트 시트 (예측 불가능한 ID 여도 권한 검사를 해요)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html',
    },
    {
      title: 'MDN — Crypto.randomUUID() (v4 UUID, 보안 컨텍스트)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID',
    },
    {
      title: 'MDN — Number.MAX_SAFE_INTEGER (2^53 - 1 까지만 안전)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER',
    },
    {
      title: 'Stripe API 문서 — Idempotent requests (멱등 키로 V4 UUID 를 권장)',
      url: 'https://docs.stripe.com/api/idempotent_requests',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
