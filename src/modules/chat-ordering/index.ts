import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'chat-ordering',
  track: 'cases',
  order: 50,
  title: '채팅 메시지 순서 — 서버 순번과 읽음 위치',
  question: '채팅방에서 내가 보낸 메시지가 새로고침하면 아래로 내려가는 건 왜일까요?',
  summary:
    '메시지 순서는 보낸 기기의 시계가 아니라 서버가 방마다 붙이는 순번으로 정해요. 보내는 순간 그린 임시 행은 서버 순번을 받으면 자리를 옮기고, 재전송은 클라이언트 메시지 id로 한 번만 저장해요. 안 읽은 수와 빠진 구간도 같은 순번을 기준으로 맞춰요.',
  minutes: 20,
  tags: ['채팅', '순서', '멱등성', '읽음', '동기화', '커서'],
  checklist: [
    {
      id: 'server-sequence',
      text: '기기 시계 대신 서버가 방 단위로 매기는 순번으로 메시지 순서를 정하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'temp-id-swap',
      text: '임시 id로 그린 행을 서버 응답의 클라이언트 메시지 id로 찾아 바꾸는 흐름을 구현할 수 있어요.',
    },
    {
      id: 'retry-same-id',
      text: '재시도할 때 같은 클라이언트 메시지 id를 유지해 중복 저장을 막을 수 있어요.',
    },
    {
      id: 'after-cursor',
      text: '재연결 뒤 마지막으로 받은 순번 이후를 요청해 빠진 구간을 채울 수 있어요.',
    },
    {
      id: 'unread-by-marker',
      text: '마지막으로 읽은 순번과 자기 메시지 제외 규칙으로 안 읽은 수를 계산할 수 있어요.',
    },
    {
      id: 'read-marker-scope',
      text: '읽음 위치를 기기별로 둘지 서버에 둘지 골라, 여러 기기의 안 읽은 수 차이를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Lamport, Time, Clocks, and the Ordering of Events in a Distributed System (공개본, 1978)',
      url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf',
    },
    {
      title: 'Matrix 클라이언트-서버 API 명세 — 트랜잭션 ID · 읽음 영수증 (m.read, m.read.private)',
      url: 'https://spec.matrix.org/latest/client-server-api/',
    },
    {
      title: 'Matrix 명세 개요 — 방 그래프와 depth 필드',
      url: 'https://spec.matrix.org/latest/',
    },
    {
      title: 'XEP-0313 Message Archive Management (Stable)',
      url: 'https://xmpp.org/extensions/xep-0313.html',
    },
    {
      title: 'XEP-0333 Displayed Markers (Stable, chat-markers 네임스페이스)',
      url: 'https://xmpp.org/extensions/xep-0333.html',
    },
    {
      title: 'RFC 9562 — UUID (UUIDv4 무작위, UUIDv7 시간 순)',
      url: 'https://www.rfc-editor.org/rfc/rfc9562',
    },
    {
      title: 'MDN — Crypto.randomUUID() (v4 UUID, 보안 컨텍스트)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID',
    },
    {
      title: 'MDN — WebSocket (close · error 이벤트, readyState)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
