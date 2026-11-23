import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'sensitive-data',
  track: 'cases',
  order: 39,
  title: '민감 정보 누출 — URL · 로그 · 에러 추적 · 분석에 남는 값',
  question:
    '비밀번호 재설정 토큰을 쿼리 문자열로 넘겼는데, 로그와 분석 도구에 그대로 남았대요. 어디서 어떻게 새는 건가요?',
  summary:
    'URL에 담긴 값은 서버 로그, 브라우저 기록, Referer 헤더에 남아요. 로그 마스킹, 에러 추적으로 보내는 본문 정리, 분석 이벤트 속성 설계, 응답 필드 최소화로 각 저장소에 남는 값을 줄이는 법을 정리해요.',
  minutes: 18,
  tags: ['보안', '로그', '개인정보', 'API', 'HTTP'],
  checklist: [
    {
      id: 'url-is-shared',
      text: 'URL에 넣은 값이 서버 접근 로그, 프록시, 브라우저 기록, Referer에 남을 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'log-allowlist',
      text: '로그를 원본 그대로 남기는 대신 허용한 필드만 기록하거나 값을 가리는 방식의 차이를 설명할 수 있어요.',
    },
    {
      id: 'error-tracker-payload',
      text: '에러 추적 도구로 보내는 요청 주소, 본문, 헤더 중 무엇을 지울지 정할 수 있어요.',
    },
    {
      id: 'analytics-properties',
      text: '분석 이벤트에 페이지 주소와 폼 값이 자동으로 담기는지 확인하고, 속성을 허용 목록으로 설계할 수 있어요.',
    },
    {
      id: 'excessive-exposure',
      text: '응답 객체를 통째로 내리는 것과 필요한 필드만 내리는 것의 차이를 OWASP API3 기준으로 설명할 수 있어요.',
    },
    {
      id: 'referrer-and-retention',
      text: 'Referrer-Policy 값에 따라 Referer에 실리는 범위가 달라지고, 로그 보존 기간을 필요한 만큼으로 정할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics, 17.9 Disclosure of Sensitive Information in URIs',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'OWASP Logging Cheat Sheet — 기록하지 않을 값, 로그 주입, 보존 기간',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
    },
    {
      title: 'OWASP API Security Top 10 2023 — API3 Broken Object Property Level Authorization',
      url: 'https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/',
    },
    {
      title: 'OWASP Session Management Cheat Sheet — URL로 세션 값을 주고받을 때의 노출',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
    },
    {
      title: 'MDN — Referrer-Policy 헤더 (기본값과 정책별 전송 범위)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy',
    },
    {
      title: 'MDN — Referer 요청 헤더 (쿼리 포함 가능, 개인정보 주의)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referer',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
