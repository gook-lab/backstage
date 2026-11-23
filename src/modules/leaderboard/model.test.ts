import { describe, expect, it } from 'vitest';
import {
  type Cursor,
  diffRanking,
  encodeScore,
  METHODS,
  makePlayers,
  pageAfter,
  periodKeys,
  type Player,
  rankOf,
  rebuildRanking,
  ranking,
  scoreFromActions,
  topN,
  zsetOrder,
} from './model';

const SEEDS = [1, 2, 3, 7, 42];

const p = (id: string, score: number, arrival: number): Player => ({ id, score, arrival });

describe('동점 규칙', () => {
  it('먼저 도달한 사람 우선이면 같은 점수에서 도달이 빠른 사람이 위에 와요', () => {
    const players = [p('user-000001', 500, 3), p('user-000002', 500, 1), p('user-000003', 500, 2)];
    expect(ranking(players, 'first-reached').map((x) => x.id)).toEqual(['user-000002', 'user-000003', 'user-000001']);
  });

  it('이름 순 규칙이면 같은 점수에서 이름이 큰 쪽이 먼저 와요 (Redis ZREVRANGE 순서)', () => {
    const players = [p('user-000001', 500, 0), p('user-000009', 500, 5), p('user-000005', 500, 9)];
    expect(ranking(players, 'member').map((x) => x.id)).toEqual(['user-000009', 'user-000005', 'user-000001']);
  });

  it('이름 순 규칙은 먼저 도달한 사람을 무시해서 같은 점수의 순서가 도달과 무관해요', () => {
    const early = p('user-000001', 500, 0);
    const late = p('user-000002', 500, 99);
    expect(ranking([early, late], 'member')[0].id).toBe('user-000002');
    expect(ranking([early, late], 'first-reached')[0].id).toBe('user-000001');
  });

  it('점수가 다르면 동점 규칙과 상관없이 점수가 높은 쪽이 위에 와요', () => {
    const players = [p('user-000009', 400, 0), p('user-000001', 600, 50)];
    expect(ranking(players, 'first-reached')[0].id).toBe('user-000001');
    expect(ranking(players, 'member')[0].id).toBe('user-000001');
  });
});

describe('정렬된 집합 점수 인코딩', () => {
  it.each(SEEDS)('시드 %i: 인코딩한 점수 순서가 비교 순서와 같아요', (seed) => {
    const players = makePlayers(2000, seed);
    for (const tie of ['first-reached', 'member'] as const) {
      const byEncoded = [...players]
        .sort((a, b) => encodeScore(b, tie) - encodeScore(a, tie) || (a.id > b.id ? -1 : 1))
        .map((x) => x.id);
      expect(byEncoded).toEqual(ranking(players, tie).map((x) => x.id));
    }
  });

  it('Redis 정렬된 집합 순서는 점수 내림차순이고, 같은 점수는 멤버 내림차순이에요', () => {
    const players = [p('user-000001', 10, 0), p('user-000002', 10, 1), p('user-000003', 20, 2)];
    expect(zsetOrder(players, 'member')).toEqual(['user-000003', 'user-000002', 'user-000001']);
  });
});

describe('순위 방식', () => {
  it.each(SEEDS)('시드 %i: DB COUNT 와 정렬된 집합은 모든 참가자의 정확한 순위가 같아요', (seed) => {
    const players = makePlayers(300, seed);
    for (const tie of ['first-reached', 'member'] as const) {
      const truth = ranking(players, tie);
      for (const me of players.slice(0, 40)) {
        const expected = truth.findIndex((x) => x.id === me.id) + 1;
        expect(rankOf(players, me, 'db-count', tie).low).toBe(expected);
        expect(rankOf(players, me, 'sorted-set', tie).low).toBe(expected);
      }
    }
  });

  it.each(SEEDS)('시드 %i: 구간별 근사의 구간은 항상 정확한 순위를 포함해요', (seed) => {
    const players = makePlayers(500, seed);
    for (const tie of ['first-reached', 'member'] as const) {
      const truth = ranking(players, tie);
      for (const me of players.slice(0, 60)) {
        const exact = truth.findIndex((x) => x.id === me.id) + 1;
        const r = rankOf(players, me, 'bucket', tie);
        expect(exact).toBeGreaterThanOrEqual(r.low);
        expect(exact).toBeLessThanOrEqual(r.high);
      }
    }
  });

  it('DB COUNT 가 읽는 항목 수는 내 위에 있는 행의 수와 같아요', () => {
    const players = makePlayers(1000, 5);
    const me = players[0];
    const above = players.filter(
      (x) => x.id !== me.id && (x.score > me.score || (x.score === me.score && x.id > me.id)),
    );
    expect(rankOf(players, me, 'db-count', 'member').reads).toBe(above.length);
  });

  it('정렬된 집합의 읽기 수는 참가자 수에 로그로 늘어나요', () => {
    const small = makePlayers(1000, 1);
    const large = makePlayers(100000, 1);
    const readsSmall = rankOf(small, small[0], 'sorted-set', 'member').reads;
    const readsLarge = rankOf(large, large[0], 'sorted-set', 'member').reads;
    expect(readsSmall).toBe(10);
    expect(readsLarge).toBe(17);
    expect(METHODS).toContain('sorted-set');
  });

  it('근사 구간은 같은 구간 안에서만 불확실해요', () => {
    const players = [p('user-000001', 950, 0), p('user-000002', 950, 1), p('user-000003', 120, 2)];
    const r = rankOf(players, players[1], 'bucket', 'first-reached');
    // 내 구간(9)과 그 위 구간(10)의 카운터 두 개만 읽어요
    expect(r).toEqual({ low: 1, high: 2, reads: 2, exact: false });
  });
});

describe('상위 N 과 페이지 커서', () => {
  it('상위 N 은 동점 규칙을 적용한 앞쪽 N 명이에요', () => {
    const players = makePlayers(500, 9);
    expect(topN(players, 5, 'first-reached')).toEqual(ranking(players, 'first-reached').slice(0, 5));
  });

  it.each(SEEDS)('시드 %i: 커서로 이어 읽으면 중복과 누락 없이 전체 순서가 나와요', (seed) => {
    const players = makePlayers(250, seed);
    const collected: string[] = [];
    let cursor: Cursor | null = null;
    for (let guard = 0; guard < 100; guard++) {
      const page = pageAfter(players, cursor, 40, 'first-reached');
      if (page.length === 0) break;
      collected.push(...page.map((x) => x.id));
      const last = page[page.length - 1];
      cursor = { id: last.id, score: last.score, arrival: last.arrival };
    }
    expect(collected).toEqual(ranking(players, 'first-reached').map((x) => x.id));
    expect(new Set(collected).size).toBe(players.length);
  });
});

describe('주기별 랭킹 키', () => {
  it('일간 키는 UTC 날짜로, 주간 키는 그 주 월요일로 정해요', () => {
    const tuesday = periodKeys(new Date('2026-11-24T10:00:00Z'));
    expect(tuesday.daily).toBe('rank:daily:2026-11-24');
    expect(tuesday.weekly).toBe('rank:weekly:2026-11-23');
  });

  it('일요일은 그 주 월요일에 속해요', () => {
    expect(periodKeys(new Date('2026-11-22T23:59:00Z')).weekly).toBe('rank:weekly:2026-11-16');
  });

  it('월요일 자정이 지나면 주간 키가 바뀌어요', () => {
    expect(periodKeys(new Date('2026-11-22T23:59:59Z')).weekly).not.toBe(
      periodKeys(new Date('2026-11-23T00:00:00Z')).weekly,
    );
  });
});

describe('DB 와 랭킹 저장소의 어긋남', () => {
  it('쓰기 하나가 빠지면 어긋난 참가자를 찾고, 재구축하면 사라져요', () => {
    const db = new Map([
      ['user-000001', 300],
      ['user-000002', 200],
      ['user-000003', 100],
    ]);
    const zset = new Map([
      ['user-000001', 250],
      ['user-000002', 200],
      ['user-000009', 50],
    ]);
    expect(diffRanking(db, zset)).toEqual({
      missing: ['user-000003'],
      stale: ['user-000001'],
      extra: ['user-000009'],
    });
    expect(diffRanking(db, rebuildRanking(db))).toEqual({ missing: [], stale: [], extra: [] });
  });
});

describe('점수는 서버가 계산', () => {
  it('서버 점수표로 합산하고, 점수표에 없는 행동은 거절해요', () => {
    expect(scoreFromActions(['correct', 'correct', 'streak'])).toEqual({ ok: true, score: 25 });
    expect(scoreFromActions(['correct', 'score=999999'])).toEqual({ ok: false, action: 'score=999999' });
  });

  it('행동이 없으면 0 점이에요', () => {
    expect(scoreFromActions([])).toEqual({ ok: true, score: 0 });
  });
});
