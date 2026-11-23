import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'audit-history',
  track: 'cases',
  order: 49,
  title: '변경 이력과 감사 로그 — 누가 언제 무엇을 바꿨는지 남기기',
  question: '관리자 화면에 상품 가격 변경 이력을 보여 주려면, 서버는 이력을 어디에 어떻게 남겨야 할까요?',
  summary:
    '현재 값 테이블과 이력 테이블을 나누고, 이력을 앱 코드와 DB 트리거 중 어디서 기록할지 비교해요. 행위자, 시각, 이전 값과 새 값, 요청 id를 담는 방법과, 지운 데이터를 소프트 삭제로 되돌리는 방법까지 정리해요.',
  minutes: 20,
  tags: ['DB', '감사 로그', '이력', '시간대'],
  checklist: [
    {
      id: 'split-current-history',
      text: '현재 값 테이블과 이력 테이블을 나눠야 하는 이유와, 이력이 현재 값을 대신하지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'capture-site',
      text: '앱 코드와 DB 트리거 중 기록 위치를 고르고, 각각이 놓치는 변경을 말할 수 있어요.',
    },
    {
      id: 'event-fields',
      text: '행위자, 시각, 대상, 이전 값과 새 값, 요청 id가 있어야 "누가 언제 무엇을"에 답할 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'append-only-tamper',
      text: '덧붙이기 전용 저장소와 변조 감지가 서로 다른 장치라는 것을 설명할 수 있어요.',
    },
    {
      id: 'soft-delete-restore',
      text: '소프트 삭제로 지운 데이터를 되돌리고, 복구도 이력에 남겨야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'utc-display',
      text: '시각은 UTC로 저장하고, 표시 시간대는 화면에서 따로 정한다는 것을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP Logging Cheat Sheet (감사 로그 · 이벤트 속성 · 변조 감지 · 보존 기간)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
    },
    {
      title: 'NIST SP 800-92 Guide to Computer Security Log Management (무결성 · 읽기 전용 매체 · 시계 동기화)',
      url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-92.pdf',
    },
    {
      title: 'PostgreSQL 문서 — 트리거 함수 (감사 테이블 예시 · OLD와 NEW)',
      url: 'https://www.postgresql.org/docs/current/plpgsql-trigger.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE TRIGGER (행마다 실행 · AFTER 트리거)',
      url: 'https://www.postgresql.org/docs/current/sql-createtrigger.html',
    },
    {
      title: 'PostgreSQL 문서 — 날짜/시간 타입 (timestamptz는 UTC로 저장)',
      url: 'https://www.postgresql.org/docs/current/datatype-datetime.html',
    },
    {
      title: 'PostgreSQL 문서 — 날짜/시간 함수 (now와 clock_timestamp 차이)',
      url: 'https://www.postgresql.org/docs/current/functions-datetime.html',
    },
    {
      title: 'MDN — Date (UTC 기준 시각 · 로컬 메서드 · toISOString)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date',
    },
    {
      title: 'MDN — Intl.DateTimeFormat (timeZone 옵션 · 기본 시간대)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
