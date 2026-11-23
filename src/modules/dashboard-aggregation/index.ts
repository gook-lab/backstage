import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'dashboard-aggregation',
  track: 'cases',
  order: 53,
  title: '대시보드 차트 집계 — 원본 매번 세기와 미리 집계',
  question: '최근 90일 일별 매출 차트가 열 때마다 10초씩 걸리는데, 서버는 차트 데이터를 어떻게 만들어야 빠른가요?',
  summary:
    '차트의 점 하나는 원본 행 여러 개를 묶은 값이에요. 매번 원본을 묶으면 기간이 길수록 읽는 행이 늘어나서 느려져요. 버킷 크기, 시간대 경계, 미리 집계와 갱신 주기, 늦게 도착한 데이터, 빈 버킷과 응답 형식을 나눠서 정리해요.',
  minutes: 20,
  tags: ['DB', '캐시', '시간대', '성능'],
  checklist: [
    {
      id: 'scan-cost',
      text: '원본 행을 매번 GROUP BY 하면 읽는 행 수가 기간에 따라 늘어나는 이유를 설명할 수 있어요.',
    },
    {
      id: 'zone-boundary',
      text: '같은 주문이 시간대에 따라 다른 날짜 버킷에 들어가는 이유를 말할 수 있어요.',
    },
    {
      id: 'rollup-refresh',
      text: '롤업 갱신 시각 뒤에 도착한 데이터가 차트에서 빠지는 이유를 설명할 수 있어요.',
    },
    {
      id: 'today-bucket',
      text: '오늘 버킷을 롤업에서 빼고 원본으로 다시 세는 편이 좋은 이유를 말할 수 있어요.',
    },
    {
      id: 'point-count',
      text: '기간에 맞춰 버킷 크기를 고르고, 차트 점 개수를 대략 가늠할 수 있어요.',
    },
    {
      id: 'null-vs-zero',
      text: '빈 버킷을 0으로 채울 때와 비울 때 차트가 주는 뜻이 어떻게 다른지 설명할 수 있어요.',
    },
    {
      id: 'response-meta',
      text: '차트 응답에 시간대와 계산 기준 시각을 함께 실어야 하는 이유를 말할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 날짜 · 시간 함수 (date_trunc 시간대 인자, date_bin, AT TIME ZONE)',
      url: 'https://www.postgresql.org/docs/current/functions-datetime.html',
    },
    {
      title: 'PostgreSQL 문서 — 집합 반환 함수 (generate_series의 timestamp with time zone 형식)',
      url: 'https://www.postgresql.org/docs/current/functions-srf.html',
    },
    {
      title: 'PostgreSQL 문서 — CREATE MATERIALIZED VIEW',
      url: 'https://www.postgresql.org/docs/current/sql-creatematerializedview.html',
    },
    {
      title: 'PostgreSQL 문서 — REFRESH MATERIALIZED VIEW (CONCURRENTLY 조건)',
      url: 'https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html',
    },
    {
      title: 'MDN — Intl.DateTimeFormat() 생성자 (timeZone 옵션)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat',
    },
    {
      title: 'TimescaleDB 문서 — time_bucket() (기본 UTC 자정 정렬, timezone 인자)',
      url: 'https://docs.timescale.com/api/latest/hyperfunctions/time_bucket/',
    },
    {
      title: 'TimescaleDB 문서 — Continuous aggregates (점진적 자동 갱신, 현재 버킷 제외)',
      url: 'https://docs.timescale.com/use-timescale/latest/continuous-aggregates/',
    },
    {
      title: 'TimescaleDB 문서 — Continuous aggregate refresh policies (start_offset · end_offset)',
      url: 'https://docs.timescale.com/use-timescale/latest/continuous-aggregates/refresh-policies/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
