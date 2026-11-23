import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'observability',
  track: 'cases',
  order: 15,
  title: '로그 · 트레이스로 원인 찾기',
  question: '사용자가 "결제가 느려요"라고 하면, 느린 곳이 화면인지 서버인지 어떻게 알 수 있을까요?',
  summary:
    '로그, 메트릭, 트레이스가 각각 무엇을 답하는지 나눠 봐요. 요청 하나의 traceparent로 FE와 BE를 잇고, span 워터폴에서 시간이 쓰인 곳을 찾아요. 평균 대신 p95 · p99를 보는 이유와 로그에 남기면 안 되는 값도 정리해요.',
  minutes: 25,
  tags: ['관측성', 'API 설계', '성능', '보안'],
  checklist: [
    {
      id: 'signal-split',
      text: '로그, 메트릭, 트레이스가 각각 어떤 질문에 답하는지 나눠 말할 수 있어요.',
    },
    {
      id: 'trace-link',
      text: 'FE 요청의 traceparent 헤더가 BE 로그와 span을 어떻게 잇는지 설명할 수 있어요.',
    },
    {
      id: 'waterfall-read',
      text: 'span 워터폴에서 시간이 가장 많이 쓰인 구간을 찾아 "화면 쪽인지 서버 쪽인지" 말할 수 있어요.',
    },
    {
      id: 'percentile-read',
      text: '평균이 괜찮아도 p95 · p99가 나쁠 수 있는 이유를 요청 수 예시로 설명할 수 있어요.',
    },
    {
      id: 'header-visibility',
      text: 'Server-Timing과 traceparent가 CORS에서 어떤 헤더 설정을 필요로 하는지 말할 수 있어요.',
    },
    {
      id: 'log-safety',
      text: '로그에 토큰, 비밀번호, 개인정보를 남기지 않고 구조화해서 남기는 방법을 설명할 수 있어요.',
    },
    {
      id: 'error-report-id',
      text: 'FE가 에러 리포트에 요청 ID를 붙여 BE 로그와 맞춰 볼 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OpenTelemetry — Signals (metrics · traces · logs)',
      url: 'https://opentelemetry.io/docs/concepts/signals/',
    },
    {
      title: 'OpenTelemetry — Traces (span, 부모 span, 자식 span)',
      url: 'https://opentelemetry.io/docs/concepts/signals/traces/',
    },
    {
      title: 'OpenTelemetry — Logs',
      url: 'https://opentelemetry.io/docs/concepts/signals/logs/',
    },
    {
      title: 'OpenTelemetry — Context propagation (traceparent)',
      url: 'https://opentelemetry.io/docs/concepts/context-propagation/',
    },
    {
      title: 'OpenTelemetry — Sampling (head · tail)',
      url: 'https://opentelemetry.io/docs/concepts/sampling/',
    },
    {
      title: 'W3C — Trace Context (Recommendation, 2021-11-23)',
      url: 'https://www.w3.org/TR/trace-context/',
    },
    {
      title: 'MDN — Server-Timing',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing',
    },
    {
      title: 'MDN — Timing-Allow-Origin',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Timing-Allow-Origin',
    },
    {
      title: 'MDN — Access-Control-Expose-Headers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers',
    },
    {
      title: 'MDN — CORS (단순 요청과 preflight)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS',
    },
    {
      title: 'OWASP — Logging Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
    },
    {
      title: 'Google SRE Book — Monitoring Distributed Systems (지연 시간 분포 · 백분위)',
      url: 'https://sre.google/sre-book/monitoring-distributed-systems/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
