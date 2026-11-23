import type { ComponentType, LazyExoticComponent } from 'react';

export interface Source {
  title: string;
  url: string;
}

/** 다 읽고 나서 스스로 답할 수 있어야 하는 판단 하나 */
export interface CheckItem {
  id: string;
  text: string;
}

export interface StudyModule {
  id: string;
  /** 로드맵 순서. 앞 모듈을 알아야 뒤 모듈이 읽힌다 */
  order: number;
  title: string;
  /** FE 가 실제로 부딪히는 질문 — 로드맵 카드의 첫 줄 */
  question: string;
  summary: string;
  minutes: number;
  tags: string[];
  checklist: CheckItem[];
  /** 본문 주장의 근거. 공식 문서 · RFC 를 먼저 둔다 */
  sources: Source[];
  Article: LazyExoticComponent<ComponentType>;
  Simulator: LazyExoticComponent<ComponentType>;
}
