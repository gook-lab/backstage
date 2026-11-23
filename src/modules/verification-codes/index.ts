import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'verification-codes',
  track: 'cases',
  order: 61,
  title: '인증번호 (OTP) — 시도 한도 · 해시 저장 · 재전송 정책',
  question:
    '인증번호 6자리 입력 화면에 3분 타이머와 재전송 버튼을 붙이는데, 서버는 번호를 어떻게 저장하고 몇 번까지 틀려도 되게 하나요?',
  summary:
    '6자리 번호는 100만 가지뿐이라 시도 한도와 만료 시각이 보안의 대부분을 맡아요. 서버는 번호를 해시로 저장하고 시도 횟수를 같은 기록에 두며, 재전송할 때 이전 번호를 무효화해요. 재전송으로 실패 횟수가 초기화되거나 발송 한도가 없으면, 공격자는 추측 기회와 문자 건수를 같이 늘려요.',
  minutes: 22,
  tags: ['인증', 'OTP', '보안', '레이트 리밋'],
  checklist: [
    {
      id: 'otp-keyspace',
      text: '6자리 번호가 100만 가지라는 점으로 시도 한도가 왜 필요한지 계산할 수 있어요.',
    },
    {
      id: 'otp-store',
      text: '번호를 평문 대신 해시로 저장해도 오프라인 공격을 막지 못하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'resend-counter',
      text: '재전송할 때 이전 번호를 무효화하고 실패 횟수를 유지해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'send-limit',
      text: '번호별과 IP별 발송 한도를 함께 두어야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'same-response',
      text: '계정이 있든 없든 발송 요청의 응답 문구와 응답 시간을 맞출 수 있어요.',
    },
    {
      id: 'fe-timer',
      text: '서버가 준 만료 시각과 재전송 간격으로 타이머와 재전송 버튼을 맞출 수 있어요.',
    },
  ],
  sources: [
    {
      title:
        'NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Lifecycle Management (3.2.2 Rate Limiting, Out-of-Band Verifiers, OTP 재사용 방지)',
      url: 'https://pages.nist.gov/800-63-4/sp800-63b.html',
    },
    {
      title: 'OWASP — Multifactor Authentication Cheat Sheet (One-Time Password Handling and Storage)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Forgot Password Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Authentication Cheat Sheet (Authentication Responses)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    },
    {
      title: 'RFC 4226 — HOTP: An HMAC-Based One-Time Password Algorithm (5.1 Notation and Symbols, T 매개변수)',
      url: 'https://www.rfc-editor.org/rfc/rfc4226.txt',
    },
    {
      title: 'RFC 6238 — TOTP: Time-Based One-Time Password Algorithm (5.2 Validation and Time-Step Size)',
      url: 'https://www.rfc-editor.org/rfc/rfc6238.txt',
    },
    {
      title: 'MDN — Crypto: getRandomValues() method',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
