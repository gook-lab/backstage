import type { StudyModule, Track } from './types';

export const TRACKS: readonly { id: Track; title: string; description: string }[] = [
  {
    id: 'basics',
    title: '기초 — DB 와 API 가 일하는 방식',
    description: '실전 사례를 읽기 전에 알아 두면 좋은 바탕이에요.',
  },
  {
    id: 'cases',
    title: '실전 사례 — 큰 서비스가 부딪힌 문제',
    description: '좌석 예매, 장바구니, 결제처럼 트래픽이 몰리는 화면 뒤에서 서버가 하는 일을 따라가요.',
  },
];

const trackRank = (t: Track) => TRACKS.findIndex((x) => x.id === t);

const loaded = import.meta.glob<{ module: StudyModule }>('./*/index.ts', { eager: true });

/** 폴더를 추가하면 자동으로 등록된다. 트랙 순서, 그다음 트랙 안 order 순 */
export const MODULES: readonly StudyModule[] = Object.values(loaded)
  .map((m) => m.module)
  .sort((a, b) => trackRank(a.track) - trackRank(b.track) || a.order - b.order);

export const moduleById = (id: string | undefined): StudyModule | undefined => MODULES.find((m) => m.id === id);

export const nextModule = (id: string): StudyModule | undefined => MODULES[MODULES.findIndex((m) => m.id === id) + 1];
