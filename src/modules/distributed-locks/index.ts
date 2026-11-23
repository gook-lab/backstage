import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'distributed-locks',
  track: 'cases',
  order: 71,
  title: '분산 락 — 여러 서버에서 한 번만 실행',
  question:
    '두 사람이 동시에 "정산 실행"을 눌러서 정산이 두 번 돌았어요. 서버가 두 대라서 그렇다는데, 한 번만 돌게 하려면 어떻게 하나요?',
  summary:
    '프로세스 안의 뮤텍스가 서버 여러 대에서 왜 무력한지부터 봐요. DB 유일 제약과 행 잠금, Redis SET NX PX 락과 만료를 비교하고, 멈췄다 깨어난 보유자의 늦은 쓰기를 펜싱 토큰으로 거절하는 방법까지 정리해요.',
  minutes: 22,
  tags: ['동시성', '분산 락', 'Redis', 'DB', '배치'],
  checklist: [
    {
      id: 'process-mutex-limit',
      text: '프로세스 안의 뮤텍스가 서버 여러 대에서는 서로를 막지 못하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'db-guard',
      text: '유일 제약이나 행 잠금으로 실행 키 한 건만 저장되게 만들 수 있어요.',
    },
    {
      id: 'redis-lease',
      text: 'SET NX PX로 잡은 락이 만료 시간을 가지며, 만료된 뒤에는 다른 서버가 잡을 수 있다는 것을 알아요.',
    },
    {
      id: 'release-by-value',
      text: '락은 내 값일 때만 지워야 한다는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fencing-token',
      text: '펜싱 토큰으로 만료 뒤 늦게 온 쓰기를 저장소가 거절하게 만들 수 있어요.',
    },
    {
      id: 'idempotent-first',
      text: '락을 더하기 전에 실행 키와 유일 제약으로 작업 자체를 멱등하게 짜는 편이 나은 경우를 고를 수 있어요.',
    },
    {
      id: 'cron-duplicate',
      text: '서버마다 뜬 같은 cron이 작업을 서버 수만큼 실행하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Redis 문서 — 분산 락 패턴 (SET NX PX, 값 비교 해제, 펜싱 토큰, Redlock)',
      url: 'https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/',
    },
    {
      title: 'Redis 문서 — SET 명령 (NX, PX)',
      url: 'https://redis.io/docs/latest/commands/set/',
    },
    {
      title: 'PostgreSQL 문서 — 명시적 락 (행 잠금 FOR UPDATE, 어드바이저리 락)',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
    {
      title: 'PostgreSQL 문서 — 관리 함수 (pg_try_advisory_lock)',
      url: 'https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS',
    },
    {
      title: 'PostgreSQL 문서 — 제약 조건 (UNIQUE 제약)',
      url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
    },
    {
      title: 'Martin Kleppmann — How to do distributed locking (리스, 펜싱 토큰, Redlock 분석)',
      url: 'https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
