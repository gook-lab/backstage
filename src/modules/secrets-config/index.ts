import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'secrets-config',
  track: 'cases',
  order: 51,
  title: '환경 설정과 비밀 값 — 번들에 들어가는 값과 서버에만 둘 값',
  question: '외부 API 키를 import.meta.env로 읽었더니 배포된 JS에 키가 보여요. 비밀 값은 서버에서 어떻게 다루나요?',
  summary:
    '빌드 도구는 접두가 붙은 환경 변수를 배포 JS에 문자열로 그대로 넣어요. 그래서 공개해도 되는 값과 서버에만 있어야 할 값을 나눠야 해요. 비밀은 서버나 BFF 뒤로 옮기고, 공개 키에도 제한을 걸고, 새어 나가면 폐기와 교체부터 해요.',
  minutes: 20,
  tags: ['보안', '설정', '배포', 'API 설계'],
  checklist: [
    {
      id: 'prefix-rule',
      text: 'VITE_ 나 NEXT_PUBLIC_ 접두가 붙은 값만 배포 번들에 들어간다는 것을 설명할 수 있어요.',
    },
    {
      id: 'split-values',
      text: '설정 값을 공개해도 되는 값과 서버에만 있어야 할 값으로 나눌 수 있어요.',
    },
    {
      id: 'proxy-secret',
      text: '외부 서비스를 부르는 비밀 값을 서버나 BFF 프록시 뒤에 두는 구조를 그릴 수 있어요.',
    },
    {
      id: 'public-limits',
      text: '공개 키에도 사용처 제한과 사용량 감시를 같이 걸어야 하는 이유를 말할 수 있어요.',
    },
    {
      id: 'leak-response',
      text: '키가 샜을 때 폐기와 교체, 사용 기록 확인 순서로 대응할 수 있어요.',
    },
    {
      id: 'history-order',
      text: '커밋 이력에 남은 비밀은 교체를 먼저 하고 이력 정리는 나중에 해야 하는 이유를 설명할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Vite — Env Variables and Modes',
      url: 'https://vite.dev/guide/env-and-mode',
    },
    {
      title: 'Next.js — How to use environment variables',
      url: 'https://nextjs.org/docs/app/guides/environment-variables',
    },
    {
      title: 'OWASP — Secrets Management Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    },
    {
      title: 'The Twelve-Factor App — III. Config',
      url: 'https://12factor.net/config',
    },
    {
      title: 'GitHub Docs — About secret scanning',
      url: 'https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning',
    },
    {
      title: 'GitHub Docs — Removing sensitive data from a repository',
      url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository',
    },
    {
      title: 'Google Cloud — Best practices for managing API keys',
      url: 'https://cloud.google.com/docs/authentication/api-keys-best-practices',
    },
    {
      title: 'Google Cloud — Manage API keys (Apply API key restrictions, Rotate an API key)',
      url: 'https://cloud.google.com/docs/authentication/api-keys',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
