import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'db-sharding',
  track: 'cases',
  order: 72,
  title: '샤딩 — 샤드 키로 나눈 DB에서 전체 목록 읽기',
  question:
    '주문 DB를 회원 기준으로 여러 대에 나눴더니 관리자의 전체 주문 목록이 느려지고 페이지도 이상해졌어요. 왜 그럴까요?',
  summary:
    '같은 데이터를 여러 벌 두는 복제와 나눠 두는 분할의 차이를 짚어요. PostgreSQL 파티셔닝과 여러 서버로 나누는 샤딩을 비교하고, 샤드 키를 고르는 기준, 범위 · 해시 · 디렉터리 분할, 샤드 키가 없는 목록을 모든 샤드에 묻고 합치는 비용을 다뤄요. 시뮬레이터에서 조회 종류별로 조회한 샤드 수와 합칠 행 수를 확인해요.',
  minutes: 22,
  tags: ['DB', '샤딩', '분산', '목록'],
  checklist: [
    {
      id: 'replication-vs-partition',
      text: '복제와 분할이 각각 어떤 문제를 푸는지 구분하고, 샤드마다 복제본을 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'partition-vs-shard',
      text: 'PostgreSQL 파티셔닝과 여러 서버로 나누는 샤딩의 위치, 라우팅, 유일 제약 차이를 설명할 수 있어요.',
    },
    {
      id: 'shard-key-colocation',
      text: '자주 함께 읽는 데이터가 같은 샤드에 모이도록 샤드 키를 고를 수 있어요.',
    },
    {
      id: 'range-hash-directory',
      text: '범위, 해시, 디렉터리 분할의 쏠림과 샤드 수를 바꿀 때의 이동 차이를 설명할 수 있어요.',
    },
    {
      id: 'scatter-gather-pages',
      text: '샤드 키가 없는 목록이 모든 샤드에 묻고 상위 행을 합쳐야 하는 이유와, 페이지 번호가 깊어질수록 드는 비용을 설명할 수 있어요.',
    },
    {
      id: 'reshard-movement',
      text: '나머지 방식과 일관 해싱이 샤드 수를 하나 늘릴 때 옮기는 키 비율이 어떻게 다른지 설명할 수 있어요.',
    },
    {
      id: 'fe-partial-shard',
      text: '샤드 일부가 응답하지 않을 때 목록이 일부만 보일 수 있다는 점을 알고, BE에 누락 여부를 어떻게 알려 주는지 물을 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostgreSQL 문서 — 선언적 파티셔닝 (Table Partitioning)',
      url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html',
    },
    {
      title: 'MongoDB 문서 — 샤딩 소개와 구조 (Sharding Introduction and Architecture)',
      url: 'https://www.mongodb.com/docs/manual/sharding/',
    },
    {
      title: 'MongoDB 문서 — 샤드 키 (Shard Keys)',
      url: 'https://www.mongodb.com/docs/manual/core/sharding-shard-key/',
    },
    {
      title: 'MongoDB 문서 — 범위 샤딩 (Ranged Sharding)',
      url: 'https://www.mongodb.com/docs/manual/core/ranged-sharding/',
    },
    {
      title: 'MongoDB 문서 — 해시 샤딩 (Hashed Sharding)',
      url: 'https://www.mongodb.com/docs/manual/core/hashed-sharding/',
    },
    {
      title: 'MongoDB 문서 — mongos 라우팅과 대상 · 브로드캐스트 연산',
      url: 'https://www.mongodb.com/docs/manual/core/sharded-cluster-query-router/',
    },
    {
      title: 'Citus 문서 — 분배 열 고르기 (Choosing Distribution Column)',
      url: 'https://docs.citusdata.com/en/stable/sharding/data_modeling.html',
    },
    {
      title: 'Citus 문서 — 개념 (질의 라우팅과 병렬 처리)',
      url: 'https://docs.citusdata.com/en/stable/get_started/concepts.html',
    },
    {
      title: 'Vitess 문서 — Vindexes (룩업 vindex와 보조 vindex)',
      url: 'https://vitess.io/docs/reference/features/vindexes/',
    },
    {
      title: 'Karger 외 — Consistent Hashing and Random Trees (논문)',
      url: 'https://people.csail.mit.edu/karger/Papers/web.pdf',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
