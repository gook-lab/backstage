import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'messaging-consent',
  track: 'cases',
  order: 75,
  title: '마케팅 수신 동의 — 채널별 저장 · 발송 직전 확인 · 원클릭 수신 거부',
  question: '설정에서 끈 마케팅 메일이 다음 날 또 왔대요. 서버는 동의를 어떻게 저장하고 지켜요?',
  summary:
    '동의는 요청을 만든 순간이 아니라 실제로 보내기 직전의 상태로 판단해야 해요. 거래 알림과 광고성 메시지를 나누고, 채널별 동의와 이력을 저장하고, RFC 8058 원클릭 수신 거부를 받는 방법을 정리해요.',
  minutes: 18,
  tags: ['동의', '메일', 'HTTP', '보안', '큐'],
  checklist: [
    {
      id: 'split-kinds',
      text: '주문 · 보안 같은 거래 알림과 쿠폰 · 이벤트 같은 마케팅 메시지를 나누고, 거래 알림에는 마케팅 토글이 붙지 않는다는 것을 설명할 수 있어요.',
    },
    {
      id: 'channel-matrix',
      text: '동의를 채널과 종류별 현재 값으로 저장하고, 과거 값은 이력으로 따로 남기는 이유를 설명할 수 있어요.',
    },
    {
      id: 'send-time-check',
      text: '예약 발송과 재시도 메시지는 발송 직전에 동의를 다시 확인해야 한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'one-click-headers',
      text: 'List-Unsubscribe와 List-Unsubscribe-Post 헤더를 DKIM 서명에 포함해야 원클릭 수신 거부가 동작한다는 것을 설명할 수 있어요.',
    },
    {
      id: 'unsubscribe-token',
      text: '로그인 없이 받는 수신 거부 링크가 추측하기 어려운 토큰과 허용 범위를 가져야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'auto-stop',
      text: '반송과 스팸 신고가 들어온 채널의 마케팅 발송을 자동으로 멈추는 기준을 정할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'RFC 8058 — One-Click Unsubscribe (3.1 발신 측 헤더, 3.2 수신 측 POST, 6 보안 고려 사항)',
      url: 'https://www.rfc-editor.org/rfc/rfc8058',
    },
    {
      title: 'RFC 2369 — The Use of URLs as Meta-Syntax for Core Mail List Commands (3.2 List-Unsubscribe)',
      url: 'https://www.rfc-editor.org/rfc/rfc2369',
    },
    {
      title: 'Gmail 도움말 — 발신자 가이드 (원클릭 수신 거부, 스팸 신고율 0.10% · 0.30%)',
      url: 'https://support.google.com/a/answer/81126',
    },
    {
      title: 'Yahoo 발신자 모범 사례 — 원클릭 수신 거부 · 2일 안 반영 · 로그인 없는 수신 거부',
      url: 'https://senders.yahooinc.com/best-practices/',
    },
    {
      title: 'KISA 불법스팸대응센터 — 광고성 정보 FAQ · 정보통신망법 안내서 제7차 개정본 요약',
      url: 'https://spam.kisa.or.kr/spam/main.do',
    },
    {
      title: '국가법령정보센터 — 정보통신망 이용촉진 및 정보보호 등에 관한 법률 (시행 2026. 10. 2.)',
      url: 'https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%A0%95%EB%B3%B4%ED%86%B5%EC%8B%A0%EB%A7%9D%EC%9D%B4%EC%9A%A9%EC%B4%89%EC%A7%84%EB%B0%8F%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%93%B1%EC%97%90%EA%B4%80%ED%95%9C%EB%B2%95%EB%A5%A0',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
