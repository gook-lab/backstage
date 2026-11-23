import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'background-jobs',
  track: 'cases',
  order: 33,
  title: '비동기 작업 — 접수 응답과 상태 조회',
  question: '엑셀 내보내기가 30초를 넘겨 타임아웃이 나는데, 서버는 이런 작업을 어떻게 나눠 처리할까요?',
  summary:
    '요청 안에서 끝낼 수 없는 작업은 202로 접수하고, 상태 주소를 받아 진행 상황을 조회해요. 상태는 queued에서 succeeded, failed, canceled로만 흐르고, 완료 알림은 폴링이나 SSE로 받아요. 취소와 재시도, 결과 파일의 만료 시각을 FE 관점에서 다뤄요.',
  minutes: 20,
  tags: ['HTTP', '비동기', '폴링', 'FE'],
  checklist: [
    {
      id: 'accepted-is-not-done',
      text: '202가 접수만 됐다는 뜻이고, 결과를 같은 응답으로 받을 수 없다는 것을 설명할 수 있어요.',
    },
    {
      id: 'status-resource',
      text: '상태 주소를 저장해 두고 조회 응답의 status 값으로 화면 문구를 나눠 보여 줄 수 있어요.',
    },
    {
      id: 'terminal-states',
      text: '종료 상태를 받으면 폴링을 멈추고, 종료된 작업의 상태가 다시 바뀌지 않아야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'poll-interval',
      text: '폴링 간격을 Retry-After 값이나 백오프로 정하고, 조회 수가 작업 시간과 간격에 따라 늘어난다는 것을 계산할 수 있어요.',
    },
    {
      id: 'notify-choice',
      text: '완료 알림을 폴링, SSE, 웹훅, 이메일 중에서 고르고, 알림을 놓쳤을 때 상태 주소로 복구하는 방법을 말할 수 있어요.',
    },
    {
      id: 'cancel-and-retry',
      text: '취소가 이미 끝난 부분을 되돌리지 않을 수 있고, 504 뒤 다시 누르면 중복 작업이 생길 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'result-expiry',
      text: '결과 파일의 만료 시각을 화면에 보여 주고, 만료된 뒤 다시 만드는 경로를 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 9110 — HTTP Semantics (202 Accepted, Retry-After, Location, 409, 504)',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
    },
    {
      title: 'MDN — 202 Accepted',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202',
    },
    {
      title: 'MDN — Retry-After 헤더',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After',
    },
    {
      title: 'MDN — 504 Gateway Timeout',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/504',
    },
    {
      title: 'MDN — EventSource (서버 전송 이벤트 연결과 HTTP/1.1 연결 수 제한)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/EventSource',
    },
    {
      title: 'Microsoft Azure Architecture Center — Asynchronous Request-Reply 패턴',
      url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply',
    },
    {
      title: 'AWS 문서 — S3 presigned URL 만료 시간 (콘솔 12시간, CLI 7일)',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
