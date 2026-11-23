import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'transactional-email',
  track: 'cases',
  order: 41,
  title: '트랜잭션 메일 — 발송 분리 · 전달 판정 · 재발송',
  question: '인증 메일이 일부 사용자에게만 안 오거나 스팸함에 가요. 다시 보내기는 어떻게 만들어야 하나요?',
  summary:
    '인증 · 재설정 메일은 요청 응답과 떼어 큐에서 보내요. SMTP 응답 코드로 일시 실패와 영구 실패를 가르고, SPF · DKIM · DMARC가 발신 도메인을 확인해요. 다시 보내기는 쿨다운과 계정 존재 여부를 드러내지 않는 응답으로 설계해요.',
  minutes: 25,
  tags: ['메일', '보안', '재시도', 'API 설계'],
  checklist: [
    {
      id: 'async-send',
      text: '메일 발송을 요청 응답에서 떼어 큐에 넣고, 화면에는 접수 결과만 보여 줄 수 있어요.',
    },
    {
      id: 'smtp-class',
      text: 'SMTP 응답의 4yz와 5yz를 나눠서, 재시도할지 반송할지 정할 수 있어요.',
    },
    {
      id: 'auth-records',
      text: 'SPF · DKIM · DMARC가 각각 무엇을 확인하는지 말하고, 발신 도메인 설정을 점검할 수 있어요.',
    },
    {
      id: 'token-life',
      text: '인증 링크 토큰을 한 번만 쓰고 일정 시간 뒤 만료되게 설계할 수 있어요.',
    },
    {
      id: 'resend-response',
      text: '다시 보내기에 쿨다운을 두되, 계정 존재 여부에 따라 응답이 달라지지 않게 만들 수 있어요.',
    },
    {
      id: 'fe-message',
      text: '반송이나 스팸 판정을 사용자 화면에 어떻게 말할지, 무엇을 말하지 않을지 정할 수 있어요.',
    },
  ],
  sources: [
    {
      title:
        'RFC 5321 — Simple Mail Transfer Protocol (4.2 응답 코드, 4.2.5 DATA 뒤 응답, 4.5.4.1 재시도 간격, 4.5.5 빈 발신 경로)',
      url: 'https://www.rfc-editor.org/rfc/rfc5321.txt',
    },
    {
      title: 'RFC 3463 — Enhanced Mail System Status Codes (X.1.1 · X.2.2 · 4.x.x · 5.x.x)',
      url: 'https://www.rfc-editor.org/rfc/rfc3463.txt',
    },
    {
      title: 'RFC 7208 — Sender Policy Framework (2.4 MAIL FROM 아이덴티티, 4.6.4 DNS 조회 한도, 8.5 softfail)',
      url: 'https://www.rfc-editor.org/rfc/rfc7208.txt',
    },
    {
      title: 'RFC 6376 — DomainKeys Identified Mail Signatures (2.5 SDID, 3.5 DKIM-Signature, bh 본문 해시)',
      url: 'https://www.rfc-editor.org/rfc/rfc6376.txt',
    },
    {
      title:
        'RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (3.1 식별자 정렬, 6.3 p 태그의 none · quarantine · reject)',
      url: 'https://www.rfc-editor.org/rfc/rfc7489.txt',
    },
    {
      title: 'OWASP — Forgot Password Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Authentication Cheat Sheet (Authentication Responses)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
