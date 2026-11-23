import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'timeouts-and-pools',
  track: 'cases',
  order: 24,
  title: '타임아웃과 커넥션 풀',
  question: '요청이 30초 동안 돌다가 504가 떠요. 서버가 느린 건가요, 어딘가에서 줄을 서고 있는 건가요?',
  summary:
    '브라우저, 프록시, 앱, DB는 각자 시간 제한을 따로 가져서, 어느 계층이 먼저 기다리기를 멈추는지에 따라 같은 504도 뜻이 달라져요. DB 커넥션은 풀에서 빌려 쓰고, 풀이 차면 요청이 줄을 서요. 이 글은 계층 순서, 풀 크기, 재시도가 부하를 키우는 경로를 시뮬레이터로 따라가요.',
  minutes: 20,
  tags: ['타임아웃', '커넥션 풀', '504', '재시도', '데드라인'],
  checklist: [
    {
      id: 'layered-timeouts',
      text: '요청이 지나는 계층마다 시간 제한이 따로 있고, 각 계층이 독립적으로 기다리기를 멈출 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'status-meaning',
      text: '502와 504가 앞단이 받은 실패를 어떻게 다르게 가리키는지 RFC 정의로 설명할 수 있어요.',
    },
    {
      id: 'outer-shorter',
      text: '바깥 시간 제한이 안쪽보다 짧으면 앞단은 포기했는데 DB 작업이 끝까지 실행되는 이유를 설명할 수 있어요.',
    },
    {
      id: 'pool-queue',
      text: '커넥션 풀이 다 차면 요청이 커넥션을 기다리며 줄을 서서, 서버가 느린 것과 구분되지 않게 보이는 이유를 설명할 수 있어요.',
    },
    {
      id: 'pool-size',
      text: '풀 크기를 무작정 키우면 안 되는 이유를 DB 연결 상한과 처리량의 관계로 설명할 수 있어요.',
    },
    {
      id: 'retry-safety',
      text: '재시도가 계층마다 곱해져 부하를 키우는 것을 알고, 멱등한 요청에만 재시도해야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'fe-timeout',
      text: 'fetch에 시간 제한을 걸고, 시간 초과와 서버 오류를 구분해 화면에 안내할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — AbortSignal.timeout() (지정 시간 뒤 중단되는 신호와 TimeoutError)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static',
    },
    {
      title: 'RFC 9110 — HTTP Semantics (502 Bad Gateway, 504 Gateway Timeout, 9.2.2 멱등 메서드)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'nginx 문서 — ngx_http_proxy_module (proxy_read_timeout)',
      url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html',
    },
    {
      title: 'PostgreSQL 문서 — 클라이언트 연결 기본값 (statement_timeout)',
      url: 'https://www.postgresql.org/docs/current/runtime-config-client.html',
    },
    {
      title: 'PostgreSQL 문서 — 연결 설정 (max_connections)',
      url: 'https://www.postgresql.org/docs/current/runtime-config-connection.html',
    },
    {
      title: 'PostgreSQL 문서 — 연결 수립과 프로세스 모델 (process per user)',
      url: 'https://www.postgresql.org/docs/current/connect-estab.html',
    },
    {
      title: 'PgBouncer 문서 — Features (세션 · 트랜잭션 풀링)',
      url: 'https://www.pgbouncer.org/features.html',
    },
    {
      title: 'HikariCP 위키 — About Pool Sizing (풀 크기 식과 작은 풀 원칙)',
      url: 'https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing',
    },
    {
      title: 'gRPC 문서 — Deadlines (기본 데드라인 없음, 데드라인 전파)',
      url: 'https://grpc.io/docs/guides/deadlines/',
    },
    {
      title: "AWS Builders' Library — Timeouts, retries, and backoff with jitter",
      url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
