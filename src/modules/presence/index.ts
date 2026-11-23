import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'presence',
  track: 'cases',
  order: 66,
  title: '접속 중 표시 — 하트비트 · TTL · 마지막 접속',
  question:
    '앱을 닫았는데 초록 점이 남고, 와이파이는 잠깐만 끊겨도 꺼져 보여요. 서버는 접속 상태를 어떻게 판단해야 할까요?',
  summary:
    '연결 종료 이벤트는 정상 종료만 알려 줘요. 강제 종료와 네트워크 끊김은 신호가 없어서, 서버는 하트비트와 만료되는 키로 접속을 판단해요. 하트비트 간격과 TTL 비율, 표시 유예, 기기별 키가 짧은 끊김과 여러 기기 접속에서 어떤 표시가 나오는지 정리해요.',
  minutes: 20,
  tags: ['실시간', 'TTL', '캐시', '개인정보', 'WebSocket'],
  checklist: [
    {
      id: 'no-close-signal',
      text: '종료 프레임 없이 연결이 끊기면 서버가 종료 이벤트를 받지 못한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'heartbeat-ttl',
      text: '하트비트마다 TTL을 갱신하고, 만료된 키를 오프라인으로 보는 흐름을 그릴 수 있어요.',
    },
    {
      id: 'ratio',
      text: '하트비트 간격이 TTL보다 길면 정상 연결도 깜빡이는 이유를 설명할 수 있어요.',
    },
    {
      id: 'grace',
      text: '표시 유예가 짧은 끊김을 숨기는 대신 실제 오프라인 표시를 늦춘다는 트레이드오프를 말할 수 있어요.',
    },
    {
      id: 'per-connection',
      text: '기기마다 키를 두면 한 기기가 끝나도 다른 기기가 살아 있을 때 온라인으로 판단할 수 있어요.',
    },
    {
      id: 'last-seen-write',
      text: '마지막 접속 시각을 매 하트비트마다 쓰지 않고 주기로 기록하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 6455 — The WebSocket Protocol (5.5.1 Close, 5.5.2 Ping, 7.1.5, 7.4.1 1006)',
      url: 'https://www.rfc-editor.org/rfc/rfc6455.html',
    },
    {
      title: 'Redis — EXPIRE',
      url: 'https://redis.io/docs/latest/commands/expire/',
    },
    {
      title: 'Redis — TTL',
      url: 'https://redis.io/docs/latest/commands/ttl/',
    },
    {
      title: 'Redis — Keyspace notifications',
      url: 'https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/',
    },
    {
      title: 'MDN — WebSocket',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket',
    },
    {
      title: 'MDN — Page Visibility API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API',
    },
    {
      title: 'MDN — Navigator: onLine property',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
