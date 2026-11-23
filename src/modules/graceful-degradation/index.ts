import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'graceful-degradation',
  track: 'cases',
  order: 42,
  title: '장애 격리 — 서킷 브레이커와 부분 응답',
  question:
    '추천 서비스 하나가 느려졌을 뿐인데 상품 상세 페이지 전체가 안 떠요. 서버는 한 부분의 장애를 어떻게 막나요?',
  summary:
    '느린 의존 서비스 하나가 스레드나 커넥션 칸을 붙잡으면 같은 칸을 쓰는 다른 호출까지 밀려요. 서킷 브레이커로 호출을 멈추고, 재시도는 횟수와 지터로 제한하고, 벌크헤드로 칸을 나눠요. 빠진 추천 자리는 대체 응답과 부분 응답으로 채우는 방법까지 정리해요.',
  minutes: 20,
  tags: ['장애 격리', '서킷 브레이커', '재시도', '지터', '벌크헤드', '대체 응답'],
  checklist: [
    {
      id: 'cascade-path',
      text: '느린 의존 서비스가 칸을 붙잡아 다른 호출까지 밀어내는 경로를 설명할 수 있어요.',
    },
    {
      id: 'breaker-states',
      text: '서킷 브레이커의 닫힘, 열림, 반열림 상태가 어떤 조건으로 바뀌는지 설명할 수 있어요.',
    },
    {
      id: 'retry-limit',
      text: '재시도가 부하를 키우는 이유와, 요청마다 재시도 횟수와 예산으로 상한을 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'jitter-spread',
      text: '같은 시각에 맞춰진 재시도를 지터로 흩으면 몰리는 호출이 줄어드는 원리를 설명할 수 있어요.',
    },
    {
      id: 'bulkhead-pool',
      text: '추천 호출에 칸을 따로 떼어 주면 상품 정보 칸이 남는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-partial-ui',
      text: '추천 응답이 빠졌을 때 영역별 빈 상태와 degraded 표시로 페이지를 살리는 화면을 그릴 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Microsoft Azure Architecture Center — Circuit Breaker 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker',
    },
    {
      title: 'Microsoft Azure Architecture Center — Retry 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/retry',
    },
    {
      title: 'Microsoft Azure Architecture Center — Bulkhead 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead',
    },
    {
      title: "AWS Builders' Library — Timeouts, retries, and backoff with jitter",
      url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/',
    },
    {
      title: 'AWS Architecture Blog — Exponential Backoff And Jitter',
      url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
    },
    {
      title: 'Google SRE 책 — Handling Overload',
      url: 'https://sre.google/sre-book/handling-overload/',
    },
    {
      title: 'Google SRE 책 — Addressing Cascading Failures',
      url: 'https://sre.google/sre-book/addressing-cascading-failures/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
