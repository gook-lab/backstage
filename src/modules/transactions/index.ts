import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'transactions',
  order: 3,
  title: '트랜잭션 · 락 · 데드락',
  question: '두 사람이 동시에 저장하면 무슨 일이 생기나요?',
  summary: '준비 중이에요.',
  minutes: 10,
  tags: ['DB', '동시성'],
  checklist: [],
  sources: [],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
