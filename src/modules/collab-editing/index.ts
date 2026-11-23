import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'collab-editing',
  track: 'cases',
  order: 77,
  title: '실시간 공동 편집 · 연산 변환과 글자 id',
  question: '같은 문서를 여러 명이 동시에 고쳐도 둘 다 글이 남게 하려면 서버는 무엇을 해야 하나요?',
  summary:
    '문서 전체를 덮어쓰는 저장은 나중 저장만 남기고, 버전 거절은 다른 줄을 고쳐도 충돌로 봐요. 편집을 삽입 · 삭제 연산으로 보내고, 서버가 위치를 고치는 OT와 글자마다 id를 붙이는 CRDT를 비교해요. 커서, 기록, 되돌리기처럼 편집 밖에서 부딪히는 문제도 함께 정리해요.',
  minutes: 25,
  tags: ['동시성', '실시간', '데이터 모델', 'FE 협업'],
  checklist: [
    {
      id: 'whole-doc-loss',
      text: '문서 전체를 덮어쓰는 저장에서 나중 저장만 남는 이유를 설명할 수 있어요.',
    },
    {
      id: 'operation',
      text: '편집을 삽입과 삭제 연산과 위치로 바꿔 보내는 요청을 만들 수 있어요.',
    },
    {
      id: 'transform',
      text: '같은 위치 연산이 어긋나는 장면을 설명하고, 위치 변환(OT)이 그 위치를 어떻게 고치는지 말할 수 있어요.',
    },
    {
      id: 'crdt',
      text: '글자 id 방식에서 도착 순서가 바뀌어도 같은 문자열이 나오는 이유를 설명할 수 있어요.',
    },
    {
      id: 'compare',
      text: 'OT와 CRDT를 중앙 서버, 메타데이터 크기, 오프라인 편집 기준으로 비교할 수 있어요.',
    },
    {
      id: 'undo-origin',
      text: '내 연산만 되돌리려면 연산마다 출처를 붙여야 하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: '위키백과 — Operational transformation (GROVE 1989 · 변환 함수 · Jupiter 비교 표)',
      url: 'https://en.wikipedia.org/wiki/Operational_transformation',
    },
    {
      title: '위키백과 — Conflict-free replicated data type (병합 함수 성질 · 글자 목록 CRDT)',
      url: 'https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type',
    },
    {
      title: 'Yjs 공식 문서 — 소개 (CRDT 정의 · 적용 순서 무관)',
      url: 'https://docs.yjs.dev/',
    },
    {
      title: 'Yjs 공식 문서 — Awareness & Presence (커서 · 저장하지 않는 상태)',
      url: 'https://docs.yjs.dev/getting-started/adding-awareness',
    },
    {
      title: 'Yjs 공식 문서 — Y.UndoManager (트래킹 출처 · 기본 동작)',
      url: 'https://docs.yjs.dev/api/undo-manager',
    },
    {
      title: 'Yjs 공식 문서 — Document Updates (상태 벡터 · 빠진 차이만 교환)',
      url: 'https://docs.yjs.dev/api/document-updates',
    },
    {
      title: 'Automerge 공식 문서 — Hello (서버 없이 병합 · 변경 기록)',
      url: 'https://automerge.org/docs/hello/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
