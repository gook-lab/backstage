import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'feature-flags',
  track: 'cases',
  order: 29,
  title: '기능 플래그와 점진 배포',
  question: '새 결제 화면을 사용자 5%에게만 먼저 보여 주자는데, 서버와 화면은 그 5%를 어떻게 똑같이 고르나요?',
  summary:
    '배포는 코드를 서버에 올리는 일이고, 출시는 사용자에게 기능을 여는 일이에요. 기능 플래그는 이 둘을 나눠 주는데, 비율 배포에서는 사용자 id를 같은 규칙에 넣어 서버와 화면이 같은 사용자를 고르게 해요. 플래그 종류별 수명, 평가 위치, 캐시 지연, 정리 날짜를 함께 정리해요.',
  minutes: 22,
  tags: ['배포', 'A/B 테스트', '캐시', 'FE 설계'],
  checklist: [
    {
      id: 'deploy-release',
      text: '배포와 출시를 나눠서 설명할 수 있어요.',
    },
    {
      id: 'flag-kinds',
      text: '릴리스, 실험, 운영, 권한 플래그를 수명과 결정 방식으로 구분할 수 있어요.',
    },
    {
      id: 'bucket',
      text: '사용자 id를 버킷으로 바꿔 비율 배포에서 같은 사용자가 같은 결과를 받게 할 수 있어요.',
    },
    {
      id: 'eval-place',
      text: '서버 평가와 클라이언트 평가를 첫 렌더와 규칙 노출 기준으로 비교할 수 있어요.',
    },
    {
      id: 'mismatch',
      text: '서버와 화면이 다른 플래그 값을 보는 요청을 어떻게 막을지 말할 수 있어요.',
    },
    {
      id: 'cleanup',
      text: '플래그마다 정리 날짜를 정하고, 킬 스위치를 따로 관리할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Martin Fowler — Feature Toggles (Pete Hodgson, 2017)',
      url: 'https://martinfowler.com/articles/feature-toggles.html',
    },
    {
      title: 'OpenFeature — Introduction',
      url: 'https://openfeature.dev/docs/reference/intro',
    },
    {
      title: 'OpenFeature 명세 — Evaluation Context',
      url: 'https://openfeature.dev/specification/sections/evaluation-context',
    },
    {
      title: 'OpenFeature 명세 — Providers',
      url: 'https://openfeature.dev/specification/sections/providers',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
