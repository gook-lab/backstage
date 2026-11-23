import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'pagination',
  order: 1,
  title: '페이지네이션 — offset · cursor',
  question: '목록 API 가 offset 이면 무엇을 조심해야 하나요?',
  summary: '준비 중이에요.',
  minutes: 10,
  tags: ['API 설계', 'DB'],
  checklist: [],
  sources: [],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
