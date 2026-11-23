import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'time-and-locale',
  track: 'cases',
  order: 23,
  title: '날짜 · 시간대 · 다국어',
  question:
    '서버가 준 "2026-03-08T10:00:00" 을 화면에 띄웠더니 사용자마다 시간이 달라요. 날짜는 어떤 형식으로 주고받아야 할까요?',
  summary:
    '시각과 벽시계 시간을 나눠서 저장과 표시의 기준을 정해요. 오프셋 없는 문자열이 왜 위험한지, RFC 3339 형식과 JS Date 파싱 차이, timestamp 와 timestamptz 의 차이, 서머타임 날의 예약, 집계 날짜의 기준, Intl 로 표시하는 법까지 정리해요.',
  minutes: 22,
  tags: ['날짜', 'API 설계', 'DB', '다국어'],
  checklist: [
    {
      id: 'instant-vs-wall',
      text: '시각(instant)과 벽시계 시간의 차이를 설명하고, 같은 순간이 시간대마다 다른 숫자로 보이는 이유를 말할 수 있어요.',
    },
    {
      id: 'offset-format',
      text: '오프셋 없는 날짜 문자열이 왜 위험한지 설명하고, 오프셋을 붙인 RFC 3339 나 UTC 문자열로 주고받아야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'js-parse',
      text: '날짜만 있는 문자열과 날짜와 시각이 함께 있는 문자열을 Date 가 다르게 해석한다는 것을 알고, 같은 값이 어느 순간을 가리키는지 예측할 수 있어요.',
    },
    {
      id: 'db-type',
      text: 'timestamp 와 timestamptz 의 차이를 설명하고, 생일처럼 시간대가 없는 날짜는 date 로 따로 저장하는 이유를 말할 수 있어요.',
    },
    {
      id: 'dst-schedule',
      text: '서머타임 전환일에 하루가 23시간이나 25시간이 되는 이유를 설명하고, 고정 오프셋 예약이 한 시간 어긋나는 이유를 말할 수 있어요.',
    },
    {
      id: 'day-boundary',
      text: '"오늘" 의 기준을 서버 UTC, 작성자 시간대, 보는 사람 시간대 중에서 고르고, 같은 데이터가 다른 날짜로 집계되는 이유를 말할 수 있어요.',
    },
    {
      id: 'locale-display',
      text: 'Intl.DateTimeFormat 과 Intl.NumberFormat 으로 같은 값을 시간대와 통화에 맞게 표시하고, 언어 협상과 번역 위치를 나눠 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 3339 — Date and Time on the Internet: Timestamps (4.3 Unknown Local Offset, 5 Date and Time format)',
      url: 'https://www.rfc-editor.org/rfc/rfc3339.html',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (12.5.4 Accept-Language, 12.5.5 Vary)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
    },
    {
      title: 'MDN — Date.parse()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse',
    },
    {
      title: 'MDN — Date (타임존 오프셋 · 서머타임 전환 때 로컬 시각 해석)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date',
    },
    {
      title: 'PostgreSQL — 8.5. Date/Time Types',
      url: 'https://www.postgresql.org/docs/current/datatype-datetime.html',
    },
    {
      title: 'IANA — Time Zone Database',
      url: 'https://www.iana.org/time-zones',
    },
    {
      title: 'MDN — Intl.DateTimeFormat() constructor (timeZone 옵션)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat',
    },
    {
      title: 'MDN — Intl.NumberFormat() constructor (currency · ISO 4217)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat',
    },
    {
      title: 'MDN — Temporal (Limited availability 상태)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal',
    },
    {
      title: 'Vercel — Cron Jobs (timezone is always UTC, Schedules 로 이전 예정)',
      url: 'https://vercel.com/docs/cron-jobs',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
