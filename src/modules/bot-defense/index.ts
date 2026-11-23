import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'bot-defense',
  track: 'cases',
  order: 76,
  title: '로그인 공격 방어 — 대입 · 스터핑 · 단계별 대응',
  question:
    '로그인 실패가 몇 번 나면 캡차를 띄우는데, 공격은 IP를 계속 바꿔요. 서버는 봇 로그인을 어떻게 알아보고 막나요?',
  summary:
    '로그인 공격은 한 계정에 많은 비밀번호를 넣는 방식과, 유출된 아이디와 비밀번호 쌍을 많은 계정에 넣는 방식으로 나뉘어요. IP 하나만 세면 IP를 바꾸는 공격을 놓치고, 계정을 잠그면 주인까지 막혀요. 그래서 계정 · IP · 전체 실패율 신호를 함께 보고, 지연 · 캡차 · 추가 인증을 단계별로 붙여요.',
  minutes: 20,
  tags: ['인증', '보안', 'OWASP', '레이트 리밋'],
  checklist: [
    {
      id: 'attack-kinds',
      text: '무차별 대입과 크리덴셜 스터핑을 공격 대상이 한 계정인지 여러 계정인지로 나눠 말할 수 있어요.',
    },
    {
      id: 'ip-weakness',
      text: 'IP 하나를 기준으로 세는 제한이 분산 공격에 약한 이유를 설명할 수 있어요.',
    },
    {
      id: 'multi-signal',
      text: '계정 · IP · 전체 실패율 신호를 함께 봐야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'lockout-dos',
      text: '계정 잠금이 남의 계정을 막는 서비스 거부가 될 수 있다는 것을 설명할 수 있어요.',
    },
    {
      id: 'graduated-response',
      text: '지연, 캡차, 추가 인증을 어떤 신호에서 켤지 단계로 나눌 수 있어요.',
    },
    {
      id: 'generic-message',
      text: '실패 문구와 응답 코드를 계정 존재 여부와 무관하게 맞출 수 있어요.',
    },
    {
      id: 'breach-check',
      text: '유출 비밀번호를 해시 앞 5자리로 조회하는 k-익명성 방식을 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP Cheat Sheet — Credential Stuffing Prevention',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html',
    },
    {
      title: 'OWASP Cheat Sheet — Authentication (Authentication Responses, Account Lockout, CAPTCHA)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
    },
    {
      title: 'OWASP Automated Threats — OAT-007 Credential Cracking',
      url: 'https://owasp.org/www-project-automated-threats-to-web-applications/assets/oats/EN/OAT-007_Credential_Cracking.html',
    },
    {
      title: 'OWASP Automated Threats — OAT-008 Credential Stuffing',
      url: 'https://owasp.org/www-project-automated-threats-to-web-applications/assets/oats/EN/OAT-008_Credential_Stuffing.html',
    },
    {
      title: 'NIST SP 800-63B-4 — Digital Identity Guidelines (3.1.1.2 Blocklist, 3.2.2 Rate Limiting)',
      url: 'https://pages.nist.gov/800-63-4/sp800-63b.html',
    },
    {
      title: 'Have I Been Pwned — API v3 (Pwned Passwords range 검색, k-익명성)',
      url: 'https://haveibeenpwned.com/API/v3',
    },
    {
      title: 'W3C — Inaccessibility of CAPTCHA (Group Draft Note, 2021-12-16)',
      url: 'https://www.w3.org/TR/turingtest/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
