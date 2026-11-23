import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'feed-fanout',
  track: 'cases',
  order: 7,
  title: '피드 — fan-out 설계',
  question: '팔로워 1,000만 명에게 새 글을 어떻게 보여 주나요?',
  summary:
    '글을 쓸 때 팔로워에게 나눠 줄지, 읽을 때 팔로우한 사람의 글을 합칠지를 정해야 해요. 유명 사용자는 쓰기가 폭발하니 읽을 때 당기고, 나머지는 미리 밀어 넣는 하이브리드가 자주 쓰여요. 정렬 가능한 ID 와 삭제 처리도 함께 봐요.',
  minutes: 18,
  tags: ['피드', 'fan-out', '정렬 ID', '쓰기 증폭'],
  checklist: [
    {
      id: 'pull-push-tradeoff',
      text: '당겨 읽기와 밀어 넣기의 비용이 쓰기와 읽기 중 어디에 쏠리는지 설명할 수 있어요.',
    },
    {
      id: 'celebrity-write',
      text: '팔로워 1,000만 명인 글 한 건이 쓰기 1,000만 번이 되고, 그 때문에 마지막 팔로워의 배달이 늦어지는 이유를 설명할 수 있어요.',
    },
    {
      id: 'hybrid-threshold',
      text: '유명 사용자 기준을 팔로워 수로 정하고, 기준을 바꾸면 쓰기와 읽기 비용이 어디로 옮겨 가는지 말할 수 있어요.',
    },
    {
      id: 'sortable-id',
      text: '시각이 앞쪽 비트에 있는 ID 는 숫자 순서가 대략 시간 순서가 된다는 것을 구조에서 읽어 낼 수 있어요.',
    },
    {
      id: 'delete-filter',
      text: '삭제된 글과 언팔로우한 사용자의 글을 조회할 때 걸러내는 방법을 설명할 수 있어요.',
    },
    {
      id: 'fe-cursor',
      text: '서버가 준 커서로 이어 받고, 새 글은 배너로 알리며, 내 글만 바로 넣는 화면 동작을 설계할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'Discord 개발자 문서 — API Reference (Snowflakes · Snowflake IDs in Pagination)',
      url: 'https://discord.com/developers/docs/reference',
    },
    {
      title: 'GitHub — twitter-archive/snowflake',
      url: 'https://github.com/twitter-archive/snowflake',
    },
    {
      title: 'Stripe API 문서 — Pagination',
      url: 'https://docs.stripe.com/api/pagination',
    },
    {
      title: 'Slack Web API 문서 — Pagination',
      url: 'https://docs.slack.dev/apis/web-api/pagination',
    },
    {
      title: 'InfoQ — Timelines at Scale (Raffi Krikorian)',
      url: 'https://www.infoq.com/presentations/Twitter-Timeline-Scalability/',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
