import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'ab-test-metrics',
  track: 'cases',
  order: 68,
  title: '실험 결과 읽기 — 노출 기록과 지표 판정',
  question: 'A/B 결과가 대시보드를 볼 때마다 바뀌는데, 어떤 숫자를 믿어야 할까요?',
  summary:
    '실험 결과는 누가 실험에 들어갔고 실제로 무엇을 봤는지에 따라 달라져요. 배정과 노출을 나눠 기록하는 법, 분석 단위와 표본 비율 점검, 들여다보기가 거짓 양성을 늘리는 이유를 정리해요.',
  minutes: 20,
  tags: ['실험', '통계', '로깅', '지표', '멱등성'],
  checklist: [
    {
      id: 'assignment-vs-exposure',
      text: '배정 기록과 노출 기록이 다르다는 것을 설명하고, 실제로 본 사용자만 분석해야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'unit-match',
      text: '배정 단위(사용자)와 분석 단위가 같아야 한다는 것을 알고, 세션이나 페이지뷰로 세면 어떤 착시가 생기는지 설명할 수 있어요.',
    },
    {
      id: 'srm-check',
      text: '배정 비율이 설계와 다르면 SRM을 의심하고, 결과를 보기 전에 배정 기록부터 확인할 수 있어요.',
    },
    {
      id: 'peeking-risk',
      text: '매일 결과를 보고 멈추면 거짓 양성이 늘어난다는 것을 설명하고, 미리 정한 기간과 표본으로 판정할 수 있어요.',
    },
    {
      id: 'duplicate-events',
      text: '노출 이벤트에 멱등 이벤트 id를 붙여 중복을 걸러내고, 지연 도착 이벤트를 어느 기간에 넣을지 정할 수 있어요.',
    },
    {
      id: 'fe-exposure-timing',
      text: '노출 이벤트를 화면이 실제로 그린 뒤 보내야 하는 이유를 알고, 배정 응답만으로 노출을 기록하지 않을 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Evan Miller — How Not To Run an A/B Test (반복 유의성 검정의 오류)',
      url: 'https://www.evanmiller.org/how-not-to-run-an-ab-test.html',
    },
    {
      title: 'Statsig 문서 — Frequentist Sequential Testing (들여다보기와 거짓 양성)',
      url: 'https://docs.statsig.com/stats-engine/sequential-testing',
    },
    {
      title: 'GrowthBook 문서 — Sequential Testing (들여다보기 문제)',
      url: 'https://docs.growthbook.io/statistics/sequential',
    },
    {
      title: 'Diagnosing Sample Ratio Mismatch in Online Controlled Experiments (KDD 2019) 논문 페이지',
      url: 'https://www.lukasvermeer.nl/publications/papers/2019/07/25/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments.html',
    },
    {
      title: 'Wikipedia — Sample ratio mismatch (카이제곱 검정으로 탐지)',
      url: 'https://en.wikipedia.org/wiki/Sample_ratio_mismatch',
    },
    {
      title: 'NIST e-Handbook 7.2.4 — 정규 근사 z 검정과 임계값 비교',
      url: 'https://www.itl.nist.gov/div898/handbook/prc/section2/prc24.htm',
    },
    {
      title: 'Kohavi · Tang · Xu — Trustworthy Online Controlled Experiments (Cambridge University Press, 2020)',
      url: 'https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
