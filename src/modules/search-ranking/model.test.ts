import { describe, expect, it } from 'vitest';
import {
  CORPUS,
  bm25Term,
  idfBM25,
  idfClassic,
  levenshtein,
  matchesOf,
  paginate,
  type Params,
  rank,
  rawScore,
  suggestTerms,
  tieGroups,
  tokenize,
} from './model';

const base: Params = {
  query: '사과 주스',
  method: 'bm25',
  popWeight: 0,
  recencyWeight: 0,
  tieBreak: 'none',
};

describe('토큰화와 매칭', () => {
  it('공백으로 나누고 소문자로 맞춰요', () => {
    expect(tokenize('  사과   Juice  ')).toEqual(['사과', 'juice']);
  });

  it('검색 단어가 하나라도 제목에 있으면 후보에 들어가요', () => {
    const ids = matchesOf('사과 주스').map((p) => p.id);
    expect(ids).toContain('p01');
    expect(ids).toContain('p06');
    expect(ids).not.toContain('p09');
  });
});

describe('점수 식', () => {
  it('BM25 idf 는 Lucene 문서 식 log(1 + (N-df+0.5)/(df+0.5)) 과 같아요', () => {
    // N=4, df=1 → log(1 + 3.5 / 1.5)
    expect(idfBM25(1, 4)).toBeCloseTo(Math.log(1 + 3.5 / 1.5), 10);
  });

  it('BM25 는 모든 문서에 있는 단어도 0 이 아니어서, 단순 TF-IDF 의 0 과 달라요', () => {
    expect(idfClassic(4, 4)).toBe(0);
    expect(idfBM25(4, 4)).toBeGreaterThan(0);
  });

  it('BM25 한 단어 점수를 손으로 계산한 값과 맞춰요 (tf=1, dl=avgdl, k1 1.2, b 0.75)', () => {
    // norm = 1.2 * (1 - 0.75 + 0.75 * 1) = 1.2 → tf / (tf + norm) = 1 / 2.2
    const expected = Math.log(1 + 3.5 / 1.5) * (1 / 2.2);
    expect(bm25Term({ tf: 1, df: 1, n: 4, dl: 3, avgdl: 3 })).toBeCloseTo(expected, 10);
  });

  it('BM25 의 tf 는 포화해서, tf 를 10배 늘려도 점수는 10배가 되지 않아요', () => {
    const one = bm25Term({ tf: 1, df: 1, n: 4, dl: 3, avgdl: 3 });
    const ten = bm25Term({ tf: 10, df: 1, n: 4, dl: 3, avgdl: 3 });
    expect(ten).toBeGreaterThan(one);
    expect(ten).toBeLessThan(one * 10);
  });

  it('단어 포함 수는 겹치는 검색 단어 개수와 같아요', () => {
    const p = CORPUS.find((x) => x.id === 'p01');
    if (!p) throw new Error('p01 없음');
    expect(rawScore(p, ['사과', '주스'], 'count')).toBe(2);
    expect(rawScore(p, ['바나나'], 'count')).toBe(0);
  });
});

describe('비즈니스 가중치', () => {
  it('판매 가중치를 올리면 같은 관련도의 상품 중 많이 팔린 쪽이 위로 가요', () => {
    const top = rank({ ...base, method: 'count', popWeight: 1, tieBreak: 'id' }, 0)[0];
    // 사과 주스 + 두 단어 모두 맞는 상품 중 판매가 가장 많은 것
    expect(top.product.id).toBe('p03');
  });

  it('가중치가 0 이면 판매량은 순위에 영향을 주지 않아요', () => {
    const a = rank({ ...base, method: 'count', popWeight: 0, tieBreak: 'id' }, 0).map((r) => r.product.id);
    const b = rank({ ...base, method: 'count', popWeight: 0, tieBreak: 'id' }, 99).map((r) => r.product.id);
    expect(a).toEqual(b);
  });
});

describe('동점과 페이지 경계', () => {
  it('기본 설정에는 같은 점수의 동점 그룹이 있어요', () => {
    expect(tieGroups(base)).toBeGreaterThan(0);
  });

  it('동점이 같은 요청 안에서 요청마다 다른 순서로 나올 수 있어요', () => {
    const orderOf = (seed: number) =>
      rank(base, seed)
        .map((r) => r.product.id)
        .join(',');
    const orders = new Set([1, 2, 3, 4, 5].map(orderOf));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('동점 처리를 id 로 고정하면 2페이지에서 중복과 누락이 없어요', () => {
    const result = paginate({ ...base, tieBreak: 'id' }, 2);
    expect(result.duplicates).toBe(0);
    expect(result.missing).toBe(0);
  });

  it('동점 처리가 없으면 기본 설정에서 중복이나 누락이 생겨요', () => {
    const result = paginate({ ...base, tieBreak: 'none' }, 2);
    expect(result.duplicates + result.missing).toBeGreaterThan(0);
  });

  it('1페이지와 2페이지가 합쳐서 기준 순서의 앞 8개와 같은 집합이면 누락이 없어요', () => {
    const result = paginate({ ...base, tieBreak: 'id' }, 2);
    expect(result.pages.flat()).toEqual(result.expected);
  });
});

describe('0건과 오타 교정', () => {
  it('아무 단어도 맞지 않으면 결과가 0건이에요', () => {
    expect(matchesOf('없는단어')).toHaveLength(0);
  });

  it('편집 거리 1 이내인 단어를 교정 후보로 내요', () => {
    expect(suggestTerms('사과 쥬스')).toEqual([{ from: '쥬스', to: '주스' }]);
  });

  it('이미 있는 단어는 교정하지 않아요', () => {
    expect(suggestTerms('사과 주스')).toEqual([]);
  });

  it('Levenshtein 거리는 글자 단위로 세요', () => {
    expect(levenshtein('주스', '쥬스')).toBe(1);
    expect(levenshtein('사과', '사과')).toBe(0);
    expect(levenshtein('주스', '오렌지')).toBeGreaterThan(1);
  });
});
