import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'search-ranking',
  track: 'cases',
  order: 21,
  title: '검색 결과 정렬 — 관련도와 랭킹',
  question: '같은 검색어인데 왜 이 상품이 맨 위에 오나요? "추천순" 은 서버에서 무엇을 할까요?',
  summary:
    '검색 결과는 단어 포함 여부, 관련도 점수, 판매와 최신 같은 비즈니스 신호를 섞어 정렬해요. 점수가 같은 상품의 순서를 정하지 않으면 2페이지에서 중복과 누락이 생기는 장면, 그리고 개인화 결과를 캐시할 때 키에 무엇을 넣어야 하는지 정리해요.',
  minutes: 22,
  tags: ['검색', '랭킹', 'BM25', '동점 처리', '페이지네이션'],
  checklist: [
    {
      id: 'inverted-index',
      text: '역색인이 단어마다 문서 목록을 가진다는 것을 설명하고, 점수 계산이 그 목록에서 시작한다는 것을 말할 수 있어요.',
    },
    {
      id: 'score-methods',
      text: '단어 포함 수, TF-IDF, BM25 가 같은 검색어에서 순위를 다르게 만드는 이유를 시뮬레이터로 비교할 수 있어요.',
    },
    {
      id: 'business-signal',
      text: '판매나 최신 같은 신호를 관련도에 곱하면 관련도가 낮은 상품이 위로 올라올 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'tie-breaker',
      text: '정렬 기준이 같은 상품이 있을 때 tie-breaker 가 없으면 2페이지에서 중복과 누락이 생기는 장면을 재현할 수 있어요.',
    },
    {
      id: 'search-after',
      text: 'offset 페이지 대신 search_after 를 쓸 때 정렬 값과 고유한 tie-breaker 가 함께 필요한 이유를 설명할 수 있어요.',
    },
    {
      id: 'cache-key',
      text: '개인화된 정렬 결과를 캐시할 때 사용자와 정렬 옵션이 캐시 키에 빠지면 다른 손님의 결과가 섞인다는 것을 말할 수 있어요.',
    },
    {
      id: 'zero-results',
      text: '0건 응답에서 오타 교정 후보를 자동 적용하지 않고 확인을 요청하는 UI 를 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Elasticsearch — Similarity settings (BM25 가 기본 similarity, k1 기본 1.2, b 기본 0.75)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-similarity.html',
    },
    {
      title: 'Lucene — BM25Similarity (idf 식 log(1 + (docCount - docFreq + 0.5) / (docFreq + 0.5)), 기본 k1 · b)',
      url: 'https://lucene.apache.org/core/10_0_0/core/org/apache/lucene/search/similarities/BM25Similarity.html',
    },
    {
      title: 'Elasticsearch — Function score query (boost_mode 기본 multiply, score_mode, min_score)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html',
    },
    {
      title: 'Elasticsearch — Paginate search results (기본 10,000 건 제한, search_after, tiebreaker, 중복 · 누락)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html',
    },
    {
      title: 'PostgreSQL — Controlling Text Search (ts_rank · ts_rank_cd 의 신호, 전역 정보를 쓰지 않는다는 설명)',
      url: 'https://www.postgresql.org/docs/current/textsearch-controls.html',
    },
    {
      title: 'PostgreSQL — Preferred Index Types for Text Search (GIN, generalized inverted index)',
      url: 'https://www.postgresql.org/docs/current/textsearch-indexes.html',
    },
    {
      title: 'Elasticsearch — Fuzzy query (편집 거리 정의, 글자 바꾸기 · 지우기 · 넣기 · 자리 바꾸기)',
      url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
