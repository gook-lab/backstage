import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'account-changes',
  track: 'cases',
  order: 70,
  title: '계정 핵심 정보 변경 — 재인증 · 대기 확정 · 세션 정리',
  question:
    '이메일 변경 화면에서 새 이메일만 받아 PATCH로 바로 바꾸면 안 되나요? 보안팀은 현재 비밀번호도 다시 묻고 옛 주소로 알림도 보내래요.',
  summary:
    '이메일은 로그인 주소이자 비밀번호 재설정 메일을 받는 주소라서, 세션만 가진 사람이 바꾸면 계정을 넘겨받을 수 있어요. 재인증으로 주인인지 먼저 확인하고, 새 주소는 확인 링크를 누르기 전까지 대기 상태로 두며, 옛 주소에 되돌리기 링크를 보내요. 비밀번호를 바꾼 뒤의 세션 정리와 계정 존재를 드러내지 않는 응답도 함께 정리해요.',
  minutes: 20,
  tags: ['인증', '계정', '보안', '세션'],
  checklist: [
    {
      id: 'reauth-check',
      text: '민감한 변경 전에 현재 비밀번호와 최근 재인증 시각을 확인해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'pending-check',
      text: '새 이메일을 확인 링크를 누르기 전까지 대기 상태로 두고, 로그인 · 알림 주소는 그대로 둬야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'old-notify',
      text: '옛 주소로 변경 알림과 되돌리기 링크를 보내야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'session-revoke',
      text: '다른 세션을 끊어도 바꾼 세션을 가진 공격자는 남는다는 점을 설명할 수 있어요.',
    },
    {
      id: 'unique-confirm',
      text: '같은 새 이메일 요청의 유일 여부를 확정 시점에 가려야 응답으로 계정 존재가 드러나지 않는 이유를 설명할 수 있어요.',
    },
    {
      id: 'token-once',
      text: '확인 링크에 만료 시간을 두고 한 번만 쓰이게 만들어야 하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title:
        "OWASP Authentication Cheat Sheet — Require Re-authentication for Sensitive Features · Changing A User's Registered Email Address · Change Password Feature",
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    },
    {
      title:
        'OWASP Session Management Cheat Sheet — Reauthentication After Risk Events · 세션 ID 재발급 · 사용자 세션 이력',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
    },
    {
      title: 'OWASP Forgot Password Cheat Sheet — 응답 일관성 · URL 토큰 · Referrer Policy',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html',
    },
    {
      title: 'NIST SP 800-63B — 4.6 Account Notifications · 5.2 Reauthentication (overall timeout)',
      url: 'https://pages.nist.gov/800-63-4/sp800-63b.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
