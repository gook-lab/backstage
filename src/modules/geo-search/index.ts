import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'geo-search',
  track: 'cases',
  order: 46,
  title: '위치 기반 검색 — 지도 영역에서 주변 점 찾기',
  question: '지도를 움직일 때마다 주변 가게를 다시 불러오는데, 서버는 근처 검색을 어떻게 하나요?',
  summary:
    '위경도 거리는 평면 근사와 구면 거리로 나뉘고, 지도 화면은 경계 상자로 질의해요. 공간 인덱스와 격자 셀로 검사할 점을 줄이고, 줌이 낮을 때는 개수 제한과 서버 클러스터링으로 응답을 줄여요.',
  minutes: 20,
  tags: ['DB', '인덱스', '지도', 'HTTP', '개인정보'],
  checklist: [
    {
      id: 'lng-lat-order',
      text: '위도와 경도의 순서를 API 계약에 적고, 평면 근사와 구면 거리가 어느 거리에서 차이가 커지는지 설명할 수 있어요.',
    },
    {
      id: 'bbox-first',
      text: '지도 화면을 경계 상자로 질의하고, 원 질의도 상자로 먼저 걸러 인덱스를 쓴다는 것을 설명할 수 있어요.',
    },
    {
      id: 'index-candidates',
      text: '전체 스캔, 경계 상자 인덱스, 격자 셀 인덱스가 검사하는 점 수가 어떻게 다른지 말할 수 있어요.',
    },
    {
      id: 'zoom-limit',
      text: '줌 수준에 따라 개수 제한과 서버 클러스터링을 고르고, 정렬 없이 자르면 화면이 흔들리는 이유를 설명할 수 있어요.',
    },
    {
      id: 'move-requests',
      text: '지도 이동 요청을 멈춘 뒤 한 번으로 줄이고, 이전 요청을 AbortController로 취소할 수 있어요.',
    },
    {
      id: 'coord-privacy',
      text: '목적에 맞게 좌표 소수 자리를 정하고, 위치 권한을 거부했을 때 대체 화면을 준비할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'PostGIS 문서 — ST_DWithin (경계 상자 비교와 인덱스 사용)',
      url: 'https://postgis.net/docs/ST_DWithin.html',
    },
    {
      title: 'PostGIS 문서 — ST_Distance (geography의 미터 단위와 use_spheroid)',
      url: 'https://postgis.net/docs/ST_Distance.html',
    },
    {
      title: 'PostGIS 문서 — 데이터 관리와 질의 (공간 인덱스 · geography 타입)',
      url: 'https://postgis.net/docs/using_postgis_dbmanagement.html',
    },
    {
      title: 'PostgreSQL 문서 — GiST 인덱스',
      url: 'https://www.postgresql.org/docs/current/gist.html',
    },
    {
      title: 'Redis 문서 — GEOSEARCH 명령 (BYBOX · COUNT ANY · WITHHASH)',
      url: 'https://redis.io/docs/latest/commands/geosearch/',
    },
    {
      title: 'Redis 문서 — 지리 공간 데이터 타입 (정렬 집합 기반 인덱스)',
      url: 'https://redis.io/docs/latest/develop/data-types/geospatial/',
    },
    {
      title: 'MDN — Geolocation API (보안 컨텍스트와 권한 요청)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API',
    },
    {
      title: 'MDN — Geolocation.getCurrentPosition()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition',
    },
    {
      title: 'MDN — AbortController (fetch 중단)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
    },
    {
      title: 'RFC 7946 — GeoJSON (경도, 위도 순서 · WGS 84)',
      url: 'https://www.rfc-editor.org/rfc/rfc7946',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
