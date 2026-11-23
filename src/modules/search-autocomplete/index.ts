import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'search-autocomplete',
  track: 'cases',
  order: 10,
  title: '검색과 자동완성 — 입력 중 요청을 줄이고 낡은 응답을 막기',
  question: '검색창에 글자를 칠 때마다 요청을 보내도 될까요?',
  summary:
    '키 입력마다 요청을 보내면 서버에 몇 건이 가는지 세어 봐요. 늦게 온 응답이 최신 결과를 덮는 경쟁 상태, 디바운스와 스로틀, LIKE 검색이 인덱스를 못 타는 이유, 자동완성 응답의 캐시와 429 처리까지 정리해요.',
  minutes: 20,
  tags: ['검색', '디바운스', '경쟁 상태', '인덱스', '캐시'],
  checklist: [
    {
      id: 'count-requests',
      text: '키 입력마다 요청을 보내면 서버가 받는 요청 수를 입력 글자 수로 계산할 수 있어요.',
    },
    {
      id: 'send-strategy',
      text: '디바운스와 스로틀의 차이를 설명하고, 검색창에 어느 쪽이 맞는지 고를 수 있어요.',
    },
    {
      id: 'stale-response',
      text: '늦게 도착한 이전 검색어의 응답이 최신 결과를 덮는 장면을 재현하고, 순번 확인이나 취소로 막을 수 있어요.',
    },
    {
      id: 'abort-scope',
      text: 'AbortController 의 취소가 화면 반영을 끊는 것인지, 서버 처리까지 멈추는 것인지 구분해서 말할 수 있어요.',
    },
    {
      id: 'index-choice',
      text: "LIKE '%어%' 가 기본 B-tree 인덱스를 쓰기 어려운 이유를 말하고, 접두어 검색과 전문 검색 인덱스 중 무엇을 고를지 정할 수 있어요.",
    },
    {
      id: 'response-cache',
      text: '자동완성 응답에 Cache-Control 을 붙일 때 공유 캐시와 개인 캐시의 차이를 근거로 설명할 수 있어요.',
    },
    {
      id: 'rate-limit',
      text: '429 를 받았을 때 Retry-After 를 읽고, 입력 요청을 어떻게 다시 보낼지 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — AbortController (abort 는 fetch 요청과 응답 본문 소비를 중단해요)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
    },
    {
      title: 'MDN — Cache-Control 헤더 (지시어 목록 · max-age · private · public)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control',
    },
    {
      title: 'MDN — Retry-After 헤더 (429 와 delay-seconds)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After',
    },
    {
      title: 'RFC 9111 — HTTP Caching (공유 캐시와 개인 캐시의 정의, 5.2.2.8 private)',
      url: 'https://www.rfc-editor.org/rfc/rfc9111.html',
    },
    {
      title: 'RFC 6585 — Additional HTTP Status Codes (429 Too Many Requests, Retry-After)',
      url: 'https://www.rfc-editor.org/rfc/rfc6585.html',
    },
    {
      title: 'PostgreSQL — Index Types (B-tree 와 LIKE 접두어 패턴, C 로케일 아닐 때 연산자 클래스)',
      url: 'https://www.postgresql.org/docs/current/indexes-types.html',
    },
    {
      title: 'PostgreSQL — Operator Classes (text_pattern_ops)',
      url: 'https://www.postgresql.org/docs/current/indexes-opclass.html',
    },
    {
      title: 'PostgreSQL — pg_trgm (trigram 인덱스가 LIKE · ILIKE 를 지원해요)',
      url: 'https://www.postgresql.org/docs/current/pgtrgm.html',
    },
    {
      title: 'PostgreSQL — Preferred Index Types for Text Search (tsvector 열의 GIN 인덱스)',
      url: 'https://www.postgresql.org/docs/current/textsearch-indexes.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
