/**
 * 검색 결과 정렬 시뮬레이션의 순수 로직.
 * 상품 목록은 예시 데이터예요. 실제 판매량이나 상품명이 아니에요.
 */

export interface Product {
  readonly id: string;
  readonly title: string;
  /** 최근 한 주 판매 수 (예시) */
  readonly sold: number;
  /** 등록 후 지난 일수 (예시). 작을수록 최신 */
  readonly ageDays: number;
}

export const CORPUS: readonly Product[] = [
  { id: 'p01', title: '사과 주스 1L', sold: 120, ageDays: 40 },
  { id: 'p02', title: '사과 주스 2L', sold: 45, ageDays: 3 },
  { id: 'p03', title: '사과 주스 500ml', sold: 310, ageDays: 200 },
  { id: 'p04', title: '사과 식초 500ml', sold: 80, ageDays: 15 },
  { id: 'p05', title: '사과 잼 저당', sold: 60, ageDays: 90 },
  { id: 'p06', title: '오렌지 주스 1L', sold: 210, ageDays: 25 },
  { id: 'p07', title: '포도 주스 1L', sold: 95, ageDays: 7 },
  { id: 'p08', title: '포도 젤리 팩', sold: 30, ageDays: 300 },
  { id: 'p09', title: '바나나 우유 1L', sold: 260, ageDays: 60 },
  { id: 'p10', title: '수박 주스 1L', sold: 15, ageDays: 1 },
  { id: 'p11', title: '복숭아 통조림 캔', sold: 40, ageDays: 120 },
  { id: 'p12', title: '토마토 주스 1L', sold: 75, ageDays: 33 },
];

export type Method = 'count' | 'tfidf' | 'bm25';
export type TieBreak = 'none' | 'id';

export const METHODS: readonly Method[] = ['count', 'tfidf', 'bm25'];
export const METHOD_LABEL: Record<Method, string> = {
  count: '단어 포함 수 (항목 수 세기)',
  tfidf: 'TF-IDF (단순 식)',
  bm25: 'BM25 (기본 k1 1.2 · b 0.75)',
};

export const TIE_BREAKS: readonly TieBreak[] = ['none', 'id'];
export const TIE_LABEL: Record<TieBreak, string> = {
  none: '없음: 동점은 서버가 정한 순서 (매번 다를 수 있어요)',
  id: '있음: 동점이면 id 오름차순',
};

export const PAGE_SIZE = 4;
export const K1 = 1.2;
export const B = 0.75;

/** 공백으로 나누고 소문자로 맞춰요. 한국어 형태소 분석은 다루지 않아요. */
export function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

/** 상품 제목을 단어 목록으로 바꿔요. 역색인이 만드는 단어 단위와 같은 생각이에요. */
export function termsOf(product: Product): string[] {
  return tokenize(product.title);
}

/** Lucene BM25Similarity 문서의 idf 식: log(1 + (N - df + 0.5) / (df + 0.5)) */
export function idfBM25(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

/** 단순 TF-IDF 의 idf: log(N / df). 모든 문서에 있는 단어는 0 이 돼요. */
export function idfClassic(df: number, n: number): number {
  return Math.log(n / df);
}

/**
 * BM25 한 단어의 점수. tf 는 문서 안 단어 수, dl 은 문서 길이(단어 수), avgdl 은 평균 길이.
 * tf 가 커질수록 점수 증가가 점점 둔해지는 포화 곡선이에요.
 */
export function bm25Term(args: { tf: number; df: number; n: number; dl: number; avgdl: number }): number {
  const { tf, df, n, dl, avgdl } = args;
  if (tf <= 0) return 0;
  const norm = K1 * (1 - B + (B * dl) / avgdl);
  return idfBM25(df, n) * (tf / (tf + norm));
}

/** 문서 집합 안에서 단어별 문서 빈도 */
export function documentFrequency(corpus: readonly Product[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const p of corpus) {
    for (const term of new Set(termsOf(p))) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return df;
}

export function rawScore(
  product: Product,
  queryTerms: readonly string[],
  method: Method,
  corpus: readonly Product[] = CORPUS,
): number {
  const docTerms = termsOf(product);
  const n = corpus.length;
  if (method === 'count') {
    return queryTerms.filter((q) => docTerms.includes(q)).length;
  }
  const df = documentFrequency(corpus);
  const avgdl = corpus.reduce((sum, p) => sum + termsOf(p).length, 0) / n;
  let score = 0;
  for (const q of queryTerms) {
    const tf = docTerms.filter((t) => t === q).length;
    if (tf === 0) continue;
    const dfq = df.get(q) ?? 0;
    if (method === 'tfidf') {
      score += tf * idfClassic(dfq, n);
    } else {
      score += bm25Term({ tf, df: dfq, n, dl: docTerms.length, avgdl });
    }
  }
  return score;
}

export interface Params {
  readonly query: string;
  readonly method: Method;
  /** 판매 가중치 0~1. 판매가 가장 많은 상품이 1 을 받아요 */
  readonly popWeight: number;
  /** 최신 가중치 0~1. 가장 최근 상품이 1 을 받아요 */
  readonly recencyWeight: number;
  readonly tieBreak: TieBreak;
}

export interface Ranked {
  readonly product: Product;
  readonly relevance: number;
  /** 관련도 × (1 + 판매 가중치 · 판매 비율 + 최신 가중치 · 최신 비율). 소수 6자리까지 맞춰 동점을 비교해요 */
  readonly final: number;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** 제목에 검색 단어가 하나라도 있는 상품만 남겨요 (OR 검색) */
export function matchesOf(query: string, corpus: readonly Product[] = CORPUS): Product[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return corpus.filter((p) => {
    const docTerms = termsOf(p);
    return terms.some((q) => docTerms.includes(q));
  });
}

/**
 * 한 번의 검색 요청이 정렬한 결과.
 * requestSeed 는 동점 순서를 요청마다 달리 만드는 데 써요.
 * 실제 DB 는 동점 순서를 보장하지 않아서 요청마다 달라질 수 있어요. 이것을 시드로 흉내 내요.
 */
export function rank(params: Params, requestSeed: number, corpus: readonly Product[] = CORPUS): Ranked[] {
  const terms = tokenize(params.query);
  const maxSold = Math.max(...corpus.map((p) => p.sold), 1);
  const maxAge = Math.max(...corpus.map((p) => p.ageDays), 1);
  const rnd = mulberry(requestSeed);
  const keyOf = new Map(corpus.map((p) => [p.id, rnd()] as const));

  const scored = matchesOf(params.query, corpus).map((product) => {
    const relevance = rawScore(product, terms, params.method, corpus);
    const popRatio = product.sold / maxSold;
    const recencyRatio = 1 - product.ageDays / maxAge;
    const boost = 1 + params.popWeight * popRatio + params.recencyWeight * recencyRatio;
    return { product, relevance, final: round6(relevance * boost) };
  });

  return scored.sort((a, b) => {
    if (a.final !== b.final) return b.final - a.final;
    if (params.tieBreak === 'id') return a.product.id < b.product.id ? -1 : 1;
    return (keyOf.get(a.product.id) ?? 0) - (keyOf.get(b.product.id) ?? 0);
  });
}

/** 기준 순서: 동점 처리를 id 로 고정한 결과. 중복·누락을 재는 정답으로 써요 */
export function groundTruth(params: Params, corpus: readonly Product[] = CORPUS): Ranked[] {
  return rank({ ...params, tieBreak: 'id' }, 0, corpus);
}

export interface PageResult {
  /** 1 페이지부터. 페이지마다 서버가 따로 정렬한다고 가정해요 (offset · limit) */
  readonly pages: readonly (readonly string[])[];
  readonly expected: readonly string[];
  readonly duplicates: number;
  readonly missing: number;
}

/**
 * offset · limit 으로 여러 페이지를 받을 때, 페이지마다 다시 정렬된 결과를 잘라요.
 * 같은 정렬 기준이라도 동점 순서가 바뀌면 페이지 경계에서 중복과 누락이 생겨요.
 */
export function paginate(params: Params, pageCount = 2, pageSize = PAGE_SIZE): PageResult {
  const pages: string[][] = [];
  for (let page = 1; page <= pageCount; page++) {
    const ranked = rank(params, page);
    const start = (page - 1) * pageSize;
    pages.push(ranked.slice(start, start + pageSize).map((r) => r.product.id));
  }
  const expectedAll = groundTruth(params).map((r) => r.product.id);
  const expected = expectedAll.slice(0, pageCount * pageSize);
  const seen = pages.flat();
  const counts = new Map<string, number>();
  for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  let duplicates = 0;
  for (const c of counts.values()) if (c > 1) duplicates += c - 1;
  const missing = expected.filter((id) => !counts.has(id)).length;
  return { pages, expected, duplicates, missing };
}

/** 같은 최종 점수끼리 묶은 동점 그룹 수 (점수가 같은 상품이 2개 이상인 그룹) */
export function tieGroups(params: Params, corpus: readonly Product[] = CORPUS): number {
  const ranked = rank({ ...params, tieBreak: 'id' }, 0, corpus);
  const byScore = new Map<number, number>();
  for (const r of ranked) byScore.set(r.final, (byScore.get(r.final) ?? 0) + 1);
  return [...byScore.values()].filter((n) => n >= 2).length;
}

/** 결과가 0건일 때 쓸 오타 교정 후보. 편집 거리 1 이내인 단어만 골라요 */
export function suggestTerms(query: string, corpus: readonly Product[] = CORPUS): { from: string; to: string }[] {
  const vocab = new Set(corpus.flatMap((p) => termsOf(p)));
  const out: { from: string; to: string }[] = [];
  for (const term of tokenize(query)) {
    if (vocab.has(term)) continue;
    const best = [...vocab].find((v) => levenshtein(term, v) <= 1);
    if (best) out.push({ from: term, to: best });
  }
  return out;
}

/** 글자(코드 포인트) 단위 Levenshtein 거리 */
export function levenshtein(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[y.length];
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
