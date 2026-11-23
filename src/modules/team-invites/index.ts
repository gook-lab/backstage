import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'team-invites',
  track: 'cases',
  order: 85,
  title: '팀 초대 — 토큰 · 수락 검증 · 상태 갱신',
  question:
    '팀 초대 링크를 단톡방에 올리면 아무나 들어오고, 취소한 링크도 살아 있다면 서버는 수락 요청에서 무엇을 확인해야 할까요?',
  summary:
    '초대는 추측할 수 없는 토큰과 만료, 1회 사용으로 보호해요. 이메일 지정 초대는 로그인 계정 이메일과 대상이 맞는지 확인하고, 공유 링크는 받을 사람을 정하지 않아서 유출되면 누구나 수락할 수 있어요. 수락할 때는 상태를 조건부로 바꾸고 초대한 사람의 권한을 다시 확인해요.',
  minutes: 22,
  tags: ['인증', '권한', '동시성', '보안'],
  checklist: [
    {
      id: 'token-random',
      text: '초대 토큰을 추측할 수 없는 무작위 값으로 만들고, 저장할 때는 평문 대신 안전하게 보관해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'kind-tradeoff',
      text: '이메일 지정 초대와 공유 링크 초대가 누가 수락할 수 있는지 어떻게 다른지 설명할 수 있어요.',
    },
    {
      id: 'email-match',
      text: '수락 요청의 로그인 이메일과 초대 대상 이메일을 비교해 거절하는 흐름을 만들 수 있어요.',
    },
    {
      id: 'conditional-accept',
      text: '수락을 pending 상태 조건이 붙은 UPDATE로 처리해 동시 수락 두 번 중 하나만 통과시킬 수 있어요.',
    },
    {
      id: 'revoke-immediate',
      text: '취소할 때 상태를 바꿔서 이미 보낸 링크가 즉시 거절되게 만들 수 있어요.',
    },
    {
      id: 'role-recheck',
      text: '초대에 기록한 권한을 수락 시점에 초대한 사람의 현재 권한과 비교해야 하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'fe-accept-result',
      text: '수락 결과별로 만료, 취소, 다른 계정, 이미 수락됨 문구를 나눠 보여 줄 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'OWASP — Forgot Password Cheat Sheet (토큰 무작위성 · 길이 · 1회 사용 · 만료 · 저장)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html',
    },
    {
      title: 'OWASP — Authorization Cheat Sheet (최소 권한 · 요청마다 권한 검사)',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
    },
    {
      title: 'PostgreSQL 문서 — UPDATE (RETURNING · 갱신된 행 수 0은 오류가 아님)',
      url: 'https://www.postgresql.org/docs/current/sql-update.html',
    },
    {
      title: 'GitHub Docs — Inviting users to join your organization (이메일 일치 수락 · 7일 만료 · 24시간 초대 한도)',
      url: 'https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
