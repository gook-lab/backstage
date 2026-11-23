/**
 * 필드 이름 변경 하나(nickname → displayName)를 배포하는 두 방식을 시간축에서 흉내 내요.
 * 손님 요청마다 "서버 응답 모양"과 "FE 번들"을 뽑고, 둘이 맞는지로 깨짐을 판정해요.
 * 같은 시드는 항상 같은 결과를 내요.
 */

/** 한 번에 바꾸기: 서버와 FE 를 같은 날 바꿔요. 단계별: 펼치고, 옮기고, 줄여요 */
export type Strategy = 'big-bang' | 'staged';

/** old: nickname 만. both: nickname 과 displayName 을 함께. renamed: displayName 만 */
export type ResponseShape = 'old' | 'both' | 'renamed';

/** 손님이 쥔 FE 번들. old 는 배포 전 번들, new 는 이번 배포의 번들 */
export type Client = 'old' | 'new';

/** 번들이 응답에서 무엇을 읽는지. strict-new: displayName 만. tolerant-new: displayName 을 읽고 없으면 nickname */
export type Bundle = 'old' | 'strict-new' | 'tolerant-new';

export const STRATEGIES: readonly Strategy[] = ['big-bang', 'staged'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  'big-bang': '한 번에 바꾸기',
  staged: '단계별로 바꾸기 (펼치고 옮기고 줄이기)',
};

export const SHAPES: readonly ResponseShape[] = ['old', 'both', 'renamed'];
export const SHAPE_LABEL: Record<ResponseShape, string> = {
  old: '옛 서버 응답 (nickname 만)',
  both: '펼친 서버 응답 (둘 다)',
  renamed: '새 서버 응답 (displayName 만)',
};

export const CLIENTS: readonly Client[] = ['old', 'new'];

export const HORIZON = 60;
export const REQUESTS_PER_TICK = 50;
/** 첫 배포가 시작되는 틱. 이 앞은 전부 옛 상태예요 */
export const RELEASE_TICK = 10;

export interface Params {
  readonly strategy: Strategy;
  /** 새 버전이 모든 서버 복제본에 퍼지는 데 걸리는 틱 (롤링 업데이트) */
  readonly rollTicks: number;
  /** 새 FE 를 배포한 뒤 옛 번들을 쥔 손님이 줄어드는 데 걸리는 틱 */
  readonly feLagTicks: number;
  /** 0 이상 1 이하. 새 번들을 받지 않고 탭을 계속 열어 두는 손님 비율 */
  readonly tail: number;
  /** 단계별에서 옛 필드를 빼는 배포 시각. 한 번에 바꾸기에서는 쓰지 않아요 */
  readonly contractTick: number;
  readonly seed: number;
}

export const DEFAULT_PARAMS: Params = {
  strategy: 'big-bang',
  rollTicks: 8,
  feLagTicks: 15,
  tail: 0.05,
  contractTick: 45,
  seed: 7,
};

/** 응답 모양과 번들이 맞으면 true. 없는 필드를 읽는 번들은 깨져요 */
export function works(shape: ResponseShape, bundle: Bundle): boolean {
  const hasNickname = shape !== 'renamed';
  const hasDisplayName = shape !== 'old';
  if (bundle === 'old') return hasNickname;
  if (bundle === 'strict-new') return hasDisplayName;
  return hasNickname || hasDisplayName;
}

export function bundleOf(client: Client, strategy: Strategy): Bundle {
  if (client === 'old') return 'old';
  return strategy === 'big-bang' ? 'strict-new' : 'tolerant-new';
}

/** 새 FE 번들이 어떤 방식으로 읽는지. 조합 표의 열 이름에 쓰여요 */
export const NEW_BUNDLE_LABEL: Record<Strategy, string> = {
  'big-bang': '새 FE 번들 (displayName 만 읽어요)',
  staged: '새 FE 번들 (displayName 을 읽고, 없으면 nickname)',
};

/** 새 FE 번들이 나가는 틱. 단계별은 펼친 서버가 다 퍼진 뒤에 내보내요 */
export function feTick(p: Params): number {
  return p.strategy === 'big-bang' ? RELEASE_TICK : RELEASE_TICK + p.rollTicks;
}

/** 롤링 진행률 0~1. 시작 틱에 첫 복제본이 바뀌기 시작해요 */
export function progress(t: number, start: number, rollTicks: number): number {
  if (t < start) return 0;
  return Math.min(1, (t - start + 1) / rollTicks);
}

/** 틱 t 에 옛 번들을 쥔 손님 비율 */
export function oldClientShare(p: Params, t: number): number {
  const fe = feTick(p);
  if (t < fe) return 1;
  const left = Math.max(0, 1 - (t - fe) / p.feLagTicks);
  return p.tail + (1 - p.tail) * left;
}

/** 요청 하나가 받는 응답 모양. r 은 0 이상 1 미만의 난수예요 */
export function shapeAt(p: Params, t: number, r: number): ResponseShape {
  if (p.strategy === 'big-bang') {
    return r < progress(t, RELEASE_TICK, p.rollTicks) ? 'renamed' : 'old';
  }
  const expanded = progress(t, RELEASE_TICK, p.rollTicks);
  const contracted = Math.min(progress(t, p.contractTick, p.rollTicks), expanded);
  if (r < contracted) return 'renamed';
  if (r < expanded) return 'both';
  return 'old';
}

/** 틱 t 시점 서버 복제본 비율과 옛 번들 손님 비율. 시각별 스냅샷에 써요 */
export function mixAt(p: Params, t: number) {
  const expanded = progress(t, RELEASE_TICK, p.rollTicks);
  if (p.strategy === 'big-bang') {
    return { old: 1 - expanded, both: 0, renamed: expanded, oldClient: oldClientShare(p, t) };
  }
  const contracted = Math.min(progress(t, p.contractTick, p.rollTicks), expanded);
  return {
    old: 1 - expanded,
    both: expanded - contracted,
    renamed: contracted,
    oldClient: oldClientShare(p, t),
  };
}

/** 같은 난수 열을 만드는 작은 PRNG (mulberry32). 시드가 같으면 결과가 같아요 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ComboStat {
  readonly total: number;
  readonly failed: number;
  /** 이 조합에서 처음 깨진 틱. 깨진 적이 없으면 null */
  readonly firstFail: number | null;
  /** 이 조합에서 마지막으로 깨진 틱 */
  readonly lastFail: number | null;
}

export type ComboTable = Record<ResponseShape, Record<Client, ComboStat>>;

export interface Result {
  /** 틱마다 깨진 요청 수. 길이는 HORIZON */
  readonly failedByTick: readonly number[];
  readonly total: number;
  readonly failed: number;
  readonly firstFail: number | null;
  readonly lastFail: number | null;
  readonly combos: ComboTable;
}

const emptyStat = (): ComboStat => ({ total: 0, failed: 0, firstFail: null, lastFail: null });

export function simulate(p: Params): Result {
  const rnd = mulberry32(p.seed);
  const failedByTick: number[] = [];
  const combos: ComboTable = {
    old: { old: emptyStat(), new: emptyStat() },
    both: { old: emptyStat(), new: emptyStat() },
    renamed: { old: emptyStat(), new: emptyStat() },
  };
  let failed = 0;
  let firstFail: number | null = null;
  let lastFail: number | null = null;

  for (let t = 0; t < HORIZON; t++) {
    const oldShare = oldClientShare(p, t);
    let failedNow = 0;
    for (let i = 0; i < REQUESTS_PER_TICK; i++) {
      const shape = shapeAt(p, t, rnd());
      const client: Client = rnd() < oldShare ? 'old' : 'new';
      const broken = !works(shape, bundleOf(client, p.strategy));
      const cell = combos[shape][client];
      combos[shape][client] = {
        total: cell.total + 1,
        failed: cell.failed + (broken ? 1 : 0),
        firstFail: broken ? (cell.firstFail ?? t) : cell.firstFail,
        lastFail: broken ? t : cell.lastFail,
      };
      if (broken) failedNow++;
    }
    failedByTick.push(failedNow);
    if (failedNow > 0) {
      failed += failedNow;
      firstFail ??= t;
      lastFail = t;
    }
  }

  return {
    failedByTick,
    total: HORIZON * REQUESTS_PER_TICK,
    failed,
    firstFail,
    lastFail,
    combos,
  };
}
