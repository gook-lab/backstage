import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'search-index-sync',
  track: 'cases',
  order: 44,
  title: '검색 색인 동기화 — 갱신 방식과 반영 시점',
  question: '상품 이름을 고치고 저장했는데 검색 결과에는 옛 이름이 나와요. 왜 두 곳이 다른가요?',
  summary:
    '검색은 DB를 직접 읽지 않고 색인에서 찾아요. 색인은 이중 쓰기, 아웃박스, CDC 중 하나로 갱신되고, 쓴 값은 refresh 뒤에야 검색에 보여요. 실패와 재시도, 전체 재색인, 삭제 반영까지 시간 축에서 직접 확인해 봐요.',
  minutes: 20,
  tags: ['검색', '색인', 'CDC', '아웃박스', '일관성', 'Elasticsearch'],
  checklist: [
    {
      id: 'two-sources',
      text: '검색 결과는 색인에서, 상세 페이지는 DB에서 오기 때문에 두 화면의 값이 잠깐 다를 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'dual-write-gap',
      text: '이중 쓰기에서 DB 저장은 성공하고 색인 쓰기만 실패하면, 재시도가 없을 때 옛 값이 남는 이유를 말할 수 있어요.',
    },
    {
      id: 'outbox-cdc',
      text: '아웃박스와 CDC가 DB 변경을 색인 쪽으로 흘려 보내는 구조를 설명하고, 둘 중 하나를 고르는 기준을 말할 수 있어요.',
    },
    {
      id: 'refresh-delay',
      text: '색인 refresh 간격 때문에 쓴 값이 검색에 보이기까지 시간이 걸리는 이유를 설명할 수 있어요.',
    },
    {
      id: 'alias-swap',
      text: '전체 재색인은 새 인덱스를 먼저 채운 뒤 별칭을 바꿔서 검색 중단 없이 교체한다는 순서를 설명할 수 있어요.',
    },
    {
      id: 'delete-path',
      text: '삭제도 색인 쓰기와 같은 경로로 반영돼야 검색에서 사라진다는 것을 알아요.',
    },
    {
      id: 'fe-response',
      text: '저장 응답의 값을 먼저 보여 주고, 검색 결과에는 반영 시간이 걸린다는 안내를 붙일 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Elasticsearch 문서 — Near real-time search (기본 1초 refresh, 최근 30초 검색 요청 조건)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/near-real-time.html',
    },
    {
      title: 'Elasticsearch 문서 — Refresh API (refresh=wait_for, 명시적 refresh 권장 여부)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-refresh.html',
    },
    {
      title: 'Elasticsearch 문서 — Index modules (index.refresh_interval 기본값과 -1)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules.html',
    },
    {
      title: 'Elasticsearch 문서 — Index API (순번으로 옛 버전이 새 버전을 덮어쓰지 않음)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html',
    },
    {
      title: 'Elasticsearch 문서 — Aliases API (여러 동작을 한 번의 원자적 작업으로 실행)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/aliases.html',
    },
    {
      title: 'Elasticsearch 문서 — Reindex API (원본 설정 미복사, 원본은 인덱스 · 별칭 · 데이터 스트림)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-reindex.html',
    },
    {
      title: 'OpenSearch 문서 — Refresh Index API (translog · 메모리 버퍼 뒤 refresh 전까지 검색 불가)',
      url: 'https://docs.opensearch.org/latest/api-reference/index-apis/refresh/',
    },
    {
      title: 'PostgreSQL 문서 — Logical Decoding Concepts (복제 슬롯, 한 번에 한 수신자, 출력 플러그인)',
      url: 'https://www.postgresql.org/docs/current/logicaldecoding-explanation.html',
    },
    {
      title: 'Debezium 문서 — Architecture (커넥터가 DB 로그를 읽고 Kafka Connect로 싱크에 전달)',
      url: 'https://debezium.io/documentation/reference/stable/architecture.html',
    },
    {
      title: 'Debezium 문서 — Outbox Event Router (아웃박스 테이블은 INSERT만, 이벤트 ID로 중복 제거)',
      url: 'https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html',
    },
    {
      title: 'microservices.io — Transactional outbox 패턴 (2PC 대신 같은 트랜잭션, 로그 추적 · 폴링 발행)',
      url: 'https://microservices.io/patterns/data/transactional-outbox.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
