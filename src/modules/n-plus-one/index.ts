import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'n-plus-one',
  order: 2,
  title: 'N+1 쿼리와 인덱스',
  question: '목록 화면 하나 그리는데 왜 API 가 느릴까요?',
  summary: '준비 중이에요.',
  minutes: 10,
  tags: ['DB', '성능'],
  checklist: [],
  sources: [],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
