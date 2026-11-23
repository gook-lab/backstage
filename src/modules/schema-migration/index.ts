import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'schema-migration',
  track: 'cases',
  order: 19,
  title: '스키마 변경과 무중단 배포',
  question: 'API 응답에서 필드 이름이 바뀐다는데, 배포하는 동안 옛 앱과 새 앱이 동시에 돌면 어떻게 되나요?',
  summary:
    '롤링 배포 중에는 옛 서버와 새 서버, 옛 번들과 새 번들이 함께 떠 있어요. 이름 변경은 펼치고 옮기고 줄이는 순서로 나눠 배포하고, 큰 테이블 변경은 락 수준을 보고 고르고, 옛 필드를 빼는 시점은 실제 옛 손님이 남았는지로 정해요.',
  minutes: 22,
  tags: ['API 설계', 'DB', '배포', '호환성'],
  checklist: [
    {
      id: 'rolling-overlap',
      text: '롤링 배포 중 옛 서버와 새 서버가 같은 시간에 응답하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'expand-contract',
      text: '필드 이름 변경을 펼치기, 옮기기, 줄이기 세 단계로 나눠야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'ddl-lock',
      text: 'ALTER TABLE 이 기본으로 잡는 락이 쓰기를 막는 이유를 설명하고, 인덱스를 CONCURRENTLY 로 만들 때의 대가를 말할 수 있어요.',
    },
    {
      id: 'compat-rules',
      text: '필드 추가는 안전하고 이름 변경과 삭제는 위험한 이유를 API 응답 기준으로 구분할 수 있어요.',
    },
    {
      id: 'sunset-signal',
      text: 'Deprecation 과 Sunset 헤더가 동작을 바꾸지 않는 신호라는 점을 알고, 옛 버전을 끊는 시점을 측정으로 정할 수 있어요.',
    },
    {
      id: 'fe-tolerance',
      text: '모르는 필드는 무시하고, 없는 필드에는 기본값을 두는 FE 읽기 코드를 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Kubernetes — Deployment (롤링 업데이트, maxSurge · maxUnavailable 기본 25%)',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    },
    {
      title: 'Martin Fowler — Parallel Change (expand, migrate, contract)',
      url: 'https://martinfowler.com/bliki/ParallelChange.html',
    },
    {
      title: 'PostgreSQL — ALTER TABLE (락 수준 · ADD COLUMN DEFAULT · SET NOT NULL · DROP COLUMN)',
      url: 'https://www.postgresql.org/docs/current/sql-altertable.html',
    },
    {
      title: 'PostgreSQL — CREATE INDEX (CONCURRENTLY · invalid 인덱스)',
      url: 'https://www.postgresql.org/docs/current/sql-createindex.html',
    },
    {
      title: 'PostgreSQL — 클라이언트 연결 기본값 (lock_timeout)',
      url: 'https://www.postgresql.org/docs/current/runtime-config-client.html',
    },
    {
      title: 'RFC 8594 — The Sunset HTTP Header Field',
      url: 'https://www.rfc-editor.org/rfc/rfc8594.html',
    },
    {
      title: 'RFC 9745 — The Deprecation HTTP Response Header Field',
      url: 'https://www.rfc-editor.org/rfc/rfc9745.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
