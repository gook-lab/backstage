import { describe, expect, it } from 'vitest';
import { ORDERS, type Params, RESHARD_KEYS, movedRatio, simulate } from './model';

const base: Params = { shards: 4, method: 'range', query: 'latest', page: 1, recentPct: 0, seed: 7 };
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

describe('샤드 키 분할 — 행은 빠짐없이 한 샤드에 들어가요', () => {
  it('샤드 수와 방식에 관계없이 샤드별 주문 수의 합은 전체 주문 수와 같아요', () => {
    for (const method of ['range', 'hash'] as const) {
      for (const shards of [1, 3, 7, 12]) {
        const r = simulate({ ...base, method, shards });
        expect(r.shardRows.reduce((a, b) => a + b, 0)).toBe(ORDERS);
      }
    }
  });
});

describe('샤드 키 조건이 있는 조회 — 샤드 하나에서 끝나요', () => {
  it.each(['range', 'hash'] as const)('%s 분할에서 회원 한 명의 조회는 샤드 한 곳만 물어요', (method) => {
    for (const shards of [1, 2, 5, 12]) {
      for (const seed of SEEDS) {
        const r = simulate({ ...base, method, shards, seed, query: 'member' });
        expect(r.targeted).toBe(true);
        expect(r.touched).toHaveLength(1);
        expect(r.returned).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('샤드 키 조건이 없는 조회 — 모든 샤드에 묻고 합쳐요', () => {
  it('전체 최신순은 샤드 수만큼 모든 샤드를 물어요', () => {
    for (const shards of [2, 5, 12]) {
      const r = simulate({ ...base, shards, query: 'latest' });
      expect(r.targeted).toBe(false);
      expect(r.touched).toHaveLength(shards);
    }
  });

  it('최신순 페이지 번호가 커질수록 샤드가 합칠 행이 늘어요', () => {
    for (const shards of [2, 6, 12]) {
      const merged = [1, 2, 3, 4, 5].map((page) => simulate({ ...base, shards, page, query: 'latest' }).merged);
      for (let i = 1; i < merged.length; i++) expect(merged[i]).toBeGreaterThan(merged[i - 1]);
    }
  });

  it('최신순 1페이지에서 샤드가 합치는 행은 샤드마다 20건을 넘지 않아요', () => {
    for (const shards of [1, 4, 12]) {
      const r = simulate({ ...base, shards, page: 1, query: 'latest' });
      expect(r.merged).toBeLessThanOrEqual(shards * 20);
      expect(r.returned).toBe(20);
    }
  });

  it('날짜 범위 조회는 모든 샤드를 물어 조건에 맞는 행을 모두 올려요', () => {
    const r = simulate({ ...base, shards: 6, query: 'dateRange' });
    expect(r.touched).toHaveLength(6);
    expect(r.merged).toBe(Math.round(ORDERS * 0.02));
    expect(r.returned).toBe(20);
  });
});

describe('샤드 쏠림 — 범위 분할은 최근 가입자에게 쏠리고 해시는 고르게 흩어요', () => {
  it('범위 분할에서 최근 가입 회원 주문이 90%면 마지막 샤드에 크게 쏠려요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, method: 'range', recentPct: 90, shards: 4, seed });
      expect(r.hotShard).toBe(3);
      expect(r.skew).toBeGreaterThan(2.5);
    }
  });

  it('해시 분할은 같은 조건에서도 최대 샤드가 평균의 1.3배를 넘지 않아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, method: 'hash', recentPct: 90, shards: 4, seed });
      expect(r.skew).toBeLessThan(1.3);
    }
  });

  it('회원 id 로 샤드 키를 주면 쏠림 조건이 없을 때 두 방식 모두 쏠림이 작아요', () => {
    for (const method of ['range', 'hash'] as const) {
      const r = simulate({ ...base, method, recentPct: 0, shards: 4, seed: 3 });
      expect(r.skew).toBeLessThan(1.2);
    }
  });
});

describe('재샤딩 이동 — 나머지 방식과 일관 해싱', () => {
  it('나머지 방식은 n에서 n+1로 늘리면 n/(n+1) 만큼 옮겨요 (정수 키 한 주기 전수 확인)', () => {
    for (let n = 1; n <= 11; n++) {
      const period = n * (n + 1);
      let moved = 0;
      for (let x = 0; x < period; x++) if (x % n !== x % (n + 1)) moved++;
      expect(moved).toBe(n * n);
    }
  });

  it('해시한 키에 나머지 방식을 쓰면 옮기는 비율이 n/(n+1) 근처예요', () => {
    for (let n = 1; n <= 11; n++) {
      const r = movedRatio('modulo', n, n + 1, RESHARD_KEYS);
      expect(Math.abs(r.ratio - n / (n + 1))).toBeLessThan(0.02);
    }
  });

  it('일관 해싱은 샤드를 하나 늘릴 때 옮기는 비율이 1/(n+1) 근처예요', () => {
    for (let n = 1; n <= 11; n++) {
      const r = movedRatio('ring', n, n + 1, RESHARD_KEYS);
      expect(Math.abs(r.ratio - 1 / (n + 1))).toBeLessThan(0.02);
    }
  });

  it('일관 해싱에서 옮겨진 키는 모두 새로 생긴 샤드로만 가요', () => {
    for (let n = 1; n <= 11; n++) {
      expect(movedRatio('ring', n, n + 1, RESHARD_KEYS).toNewOnly).toBe(true);
    }
  });
});
