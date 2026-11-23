// A/B 실험 결과 판정 시뮬레이터의 순수 모델.
// 모든 수치는 예시예요. 기준 전환율 10%, 기간 14일은 설명을 위해 고정한 값이에요.

export const DAYS = 14;
export const RUNS = 300;
export const BASE_RATE = 0.1;
/** 양측 5% 유의 수준의 z 기준값 (표준정규분포의 97.5% 분위수) */
export const CRITICAL_Z = 1.96;

export type Judge = 'fixed' | 'daily';
export type RecordMode = 'assign' | 'expose';

export interface Params {
  /** 상대 효과. 0.1 이면 B 가 A 보다 10% 높은 전환율을 가져요(실제 값) */
  lift: number;
  visitorsPerDay: number;
  /** 버튼이 보이는 페이지까지 가는 방문자 비율 */
  reach: number;
  judge: Judge;
  record: RecordMode;
  seed: number;
}

export interface RunResult {
  significant: boolean;
  /** 판정이 난 날(1부터). 판정이 없으면 DAYS */
  decisionDay: number;
  /** 판정 시점까지 모은 데이터로 잰 상대 효과. 계산할 수 없으면 NaN */
  measuredLift: number;
  /** 날마다 계산한 z 값 */
  zPath: number[];
}

export interface Summary {
  runs: number;
  /** 유의하다고 판정한 실험 비율 */
  significantRate: number;
  /** 모든 실험의 측정 효과 평균 */
  measuredLiftAvg: number;
  /** 유의하다고 판정한 실험만 본 측정 효과 평균. 유의한 실험이 없으면 null */
  significantLiftAvg: number | null;
  /** 첫 실험의 날마다 z 값 (차트용) */
  firstZPath: number[];
}

/** 결정론적 난수. 같은 시드는 항상 같은 방문자 흐름을 만들어요. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Counts {
  nA: number;
  cA: number;
  nB: number;
  cB: number;
}

/** 두 전환율 차이를 그 표준오차로 나눈 값. 집단이 비면 0 */
export function zStat(c: Counts): number {
  if (c.nA === 0 || c.nB === 0) return 0;
  const pA = c.cA / c.nA;
  const pB = c.cB / c.nB;
  const se = Math.sqrt((pA * (1 - pA)) / c.nA + (pB * (1 - pB)) / c.nB);
  if (se === 0) return 0;
  return (pB - pA) / se;
}

export function measuredLift(c: Counts): number {
  if (c.nA === 0 || c.nB === 0 || c.cA === 0) return Number.NaN;
  return c.cB / c.nB / (c.cA / c.nA) - 1;
}

/**
 * 방문자마다 난수를 항상 세 개 뽑아요(배정, 도달, 전환).
 * 효과 크기와 기록 방식이 달라도 같은 시드면 같은 방문자 흐름을 봐요.
 */
export function runOnce(p: Params, rnd: () => number): RunResult {
  const perDay: Counts[] = [];
  const c: Counts = { nA: 0, cA: 0, nB: 0, cB: 0 };
  for (let day = 0; day < DAYS; day++) {
    for (let v = 0; v < p.visitorsPerDay; v++) {
      const isB = rnd() < 0.5;
      const reached = rnd() < p.reach;
      const liftHere = isB && reached ? p.lift : 0;
      const converted = rnd() < BASE_RATE * (1 + liftHere) ? 1 : 0;
      if (p.record === 'expose' && !reached) continue;
      if (isB) {
        c.nB++;
        c.cB += converted;
      } else {
        c.nA++;
        c.cA += converted;
      }
    }
    perDay.push({ ...c });
  }

  const zPath = perDay.map(zStat);
  let decisionDay = DAYS;
  let significant = false;
  if (p.judge === 'daily') {
    const hit = zPath.findIndex((z) => Math.abs(z) >= CRITICAL_Z);
    if (hit >= 0) {
      decisionDay = hit + 1;
      significant = true;
    }
  } else {
    significant = Math.abs(zPath[DAYS - 1]) >= CRITICAL_Z;
  }
  return {
    significant,
    decisionDay,
    measuredLift: measuredLift(perDay[decisionDay - 1]),
    zPath,
  };
}

export function summarize(p: Params, runs: number = RUNS): Summary {
  const rnd = mulberry32(p.seed);
  let sig = 0;
  let liftSum = 0;
  let liftN = 0;
  let sigLiftSum = 0;
  let sigLiftN = 0;
  let firstZPath: number[] = [];
  for (let r = 0; r < runs; r++) {
    const res = runOnce(p, rnd);
    if (r === 0) firstZPath = res.zPath;
    if (Number.isFinite(res.measuredLift)) {
      liftSum += res.measuredLift;
      liftN++;
    }
    if (res.significant) {
      sig++;
      if (Number.isFinite(res.measuredLift)) {
        sigLiftSum += res.measuredLift;
        sigLiftN++;
      }
    }
  }
  return {
    runs,
    significantRate: sig / runs,
    measuredLiftAvg: liftN === 0 ? Number.NaN : liftSum / liftN,
    significantLiftAvg: sigLiftN === 0 ? null : sigLiftSum / sigLiftN,
    firstZPath,
  };
}
