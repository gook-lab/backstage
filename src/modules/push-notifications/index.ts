import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'push-notifications',
  track: 'cases',
  order: 38,
  title: '웹 푸시 알림 — 구독 저장과 만료 구독 정리',
  question: '푸시 구독은 받았는데 어떤 사용자는 알림을 못 받아요. 서버는 구독을 어떻게 관리하고 보내야 하나요?',
  summary:
    '브라우저가 만든 구독은 endpoint와 키로 서버에 저장하고, 발송 요청은 VAPID로 서버를 밝혀 보내요. 푸시 서비스는 TTL 안에서만 전달을 시도하고, 404를 받은 구독은 지워요. 발송 성공이 기기 도착을 뜻하지 않아서 알림함을 원본으로 둬요.',
  minutes: 16,
  tags: ['Web Push', 'VAPID', '구독', 'HTTP 헤더', '알림'],
  checklist: [
    {
      id: 'permission-after-gesture',
      text: '알림 권한 요청과 구독 생성을 사용자 동작 뒤에 두는 이유를 설명할 수 있어요.',
    },
    {
      id: 'store-subscription-keys',
      text: 'endpoint, p256dh, auth를 서버에 저장해야 하고, endpoint를 다른 사용자에게 노출하면 안 된다는 것을 설명할 수 있어요.',
    },
    {
      id: 'vapid-identity',
      text: 'VAPID 공개키와 서명된 JWT가 발송 서버를 식별하고, aud와 exp가 무엇을 제한하는지 말할 수 있어요.',
    },
    {
      id: 'ttl-topic',
      text: 'TTL이 지나면 전달을 시도하지 않는다는 것과 같은 Topic의 미전달 메시지가 새 메시지로 대체된다는 것을 설명할 수 있어요.',
    },
    {
      id: 'expired-404',
      text: '404를 받은 구독을 서버에서 지우고, RFC 8030에서 410이 수신 확인 응답으로 쓰인다는 점을 구분할 수 있어요.',
    },
    {
      id: 'alert-inbox-source',
      text: '발송 201이 기기 도착을 뜻하지 않으므로 알림 내용을 앱 서버의 알림함에 먼저 저장해야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'resubscribe-on-change',
      text: 'pushsubscriptionchange 이벤트에서 새 구독을 받아 서버에 다시 보낼 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 8030 — Generic Event Delivery Using HTTP Push (Web Push 프로토콜)',
      url: 'https://www.rfc-editor.org/rfc/rfc8030',
    },
    {
      title: 'RFC 8291 — Message Encryption for Web Push (p256dh · auth 키)',
      url: 'https://www.rfc-editor.org/rfc/rfc8291',
    },
    {
      title: 'RFC 8292 — Voluntary Application Server Identification for Web Push (VAPID)',
      url: 'https://www.rfc-editor.org/rfc/rfc8292',
    },
    {
      title: 'W3C — Push API 명세 (pushsubscriptionchange · applicationServerKey)',
      url: 'https://www.w3.org/TR/push-api/',
    },
    {
      title: 'MDN — Push API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',
    },
    {
      title: 'MDN — PushManager.subscribe()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe',
    },
    {
      title: 'MDN — PushSubscription',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription',
    },
    {
      title: 'MDN — PushSubscription.getKey()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/getKey',
    },
    {
      title: 'MDN — Notifications API (권한 요청과 사용자 제스처)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
