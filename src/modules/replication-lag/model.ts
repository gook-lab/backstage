export type Strategy = 'random' | 'sticky' | 'window' | 'lsn' | 'response';

export const STRATEGIES: readonly { id: Strategy; label: string; summary: string }[] = [
  {
    id: 'random',
    label: '무작위 복제본',
    summary:
      '읽기마다 복제본을 무작위로 골라요. 방금 쓴 글이 아직 따라오지 않은 복제본을 고르면 목록에서 빠지고, 새로고침마다 값이 앞뒤로 흔들릴 수 있어요.',
  },
  {
    id: 'sticky',
    label: '세션마다 복제본 고정',
    summary:
      '한 사용자는 항상 같은 복제본을 읽어요. 그 복제본은 한 번 반영한 쓰기를 되돌리지 않아서 값이 뒤로 가지 않아요. 다만 그 복제본이 늦으면 방금 쓴 글은 계속 안 보여요.',
  },
  {
    id: 'window',
    label: '쓴 뒤 N초 주 DB',
    summary:
      '쓴 직후 N초 동안은 주 DB 에서 읽고, 그 뒤에는 복제본을 써요. 주 DB 읽기가 늘어나고, N초보다 긴 지연은 막지 못해요.',
  },
  {
    id: 'lsn',
    label: '쓴 위치 확인',
    summary: '쓰기 때 받은 위치(LSN)까지 따라온 복제본만 골라 읽어요. 따라온 복제본이 없으면 주 DB 에서 읽어요.',
  },
  {
    id: 'response',
    label: '응답 글 직접 넣기',
    summary:
      '쓰기 응답의 글을 화면 목록에 바로 넣고, 서버 목록에 나타날 때까지 유지해요. 새로고침하면 화면 상태가 사라져서 이 보호도 사라져요.',
  },
];

export const SESSIONS = 400;
/** 저장 뒤 목록으로 돌아오는 데 걸리는 시간 */
export const NAV_MS = 500;
/** 새로고침 사이 간격 */
export const RELOAD_GAP_MS = 1500;
export const RELOADS = 6;
export const READS_PER_SESSION = RELOADS + 1;
export const MAX_REPLICAS = 5;
/** 튐이 일어나면 평균 지연의 몇 배가 되는지 */
export const SPIKE_FACTOR = 4;

export interface Config {
  readonly strategy: Strategy;
  /** 읽기 복제본 수 (1 ~ 5) */
  readonly replicas: number;
  /** 복제본의 평균 지연 */
  readonly lagMs: number;
  /** 지연이 튀는 확률 (0 ~ 100) */
  readonly spikePct: number;
  /** window 전략에서 쓴 뒤 주 DB 로 읽는 시간 */
  readonly windowMs: number;
  /** 초당 쓰기 수. 모든 세션의 쓰기가 이 간격으로 들어와요 */
  readonly writesPerSec: number;
  readonly seed: number;
}

export interface Result {
  readonly sessions: number;
  /** 저장 뒤 첫 목록에서 방금 쓴 글이 없던 세션 수 */
  readonly firstMisses: number;
  readonly firstMissRatio: number;
  /** 보였던 글이 새로고침 뒤 사라진 횟수 */
  readonly regressions: number;
  readonly reads: number;
  readonly primaryReads: number;
  readonly primaryShare: number;
  /** 주 DB 읽기를 초당으로 환산한 값 */
  readonly primaryPerSec: number;
  /** 쓰기가 복제본에 보이기까지 걸린 시간의 95분위 */
  readonly lagP95Ms: number;
}

/** 같은 시드면 같은 순서로 난수를 뽑아요 */
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

const clampReplicas = (n: number) => Math.min(MAX_REPLICAS, Math.max(1, Math.round(n)));

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

export function simulate(config: Config): Result {
  const n = clampReplicas(config.replicas);
  const gapMs = 1000 / Math.max(1, config.writesPerSec);
  const worldRandom = mulberry32(config.seed);

  // 쓰기 순서와 복제본 반영 시각은 전략과 무관하게 같은 시드에서 정해져요.
  const writeAt: number[] = [];
  let clock = 0;
  for (let k = 0; k < SESSIONS; k++) {
    clock += gapMs * (0.5 + worldRandom());
    writeAt.push(clock);
  }

  const applyAt: number[][] = [];
  const lagSamples: number[] = [];
  for (let r = 0; r < n; r++) {
    // 복제본마다 속도가 달라요. 한 복제본은 끝까지 같은 속도예요.
    const speed = 0.6 + 0.8 * worldRandom();
    const applied: number[] = [];
    let previous = 0;
    for (let k = 0; k < SESSIONS; k++) {
      let lag = config.lagMs * speed * (0.5 + worldRandom());
      if (worldRandom() * 100 < config.spikePct) lag *= SPIKE_FACTOR;
      // WAL 은 순서대로 재생되므로 앞 쓰기보다 먼저 보일 수 없어요.
      const at = Math.max(writeAt[k] + lag, previous);
      applied.push(at);
      lagSamples.push(at - writeAt[k]);
      previous = at;
    }
    applyAt.push(applied);
  }

  const horizonMs = writeAt[SESSIONS - 1] + NAV_MS + RELOADS * RELOAD_GAP_MS;
  let reads = 0;
  let primaryReads = 0;
  let firstMisses = 0;
  let regressions = 0;

  for (let k = 0; k < SESSIONS; k++) {
    // 세션마다 따로 난수를 써서, 한 세션의 선택이 다른 세션에 번지지 않게 해요.
    const random = mulberry32((config.seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
    const sticky = Math.floor(random() * n);
    let previousVisible: boolean | null = null;

    for (let j = 0; j < READS_PER_SESSION; j++) {
      const at = writeAt[k] + NAV_MS + j * RELOAD_GAP_MS;
      const caughtUp = (r: number) => applyAt[r][k] <= at;

      let target: number | 'primary';
      switch (config.strategy) {
        case 'random':
        case 'response':
          target = Math.floor(random() * n);
          break;
        case 'sticky':
          target = sticky;
          break;
        case 'window':
          target = at - writeAt[k] < config.windowMs ? 'primary' : Math.floor(random() * n);
          break;
        case 'lsn': {
          const ready = Array.from({ length: n }, (_, r) => r).filter(caughtUp);
          target = ready.length > 0 ? (ready[Math.floor(random() * ready.length)] ?? 'primary') : 'primary';
          break;
        }
      }

      // 응답 반영은 첫 화면에서만 보장돼요. 새로고침하면 화면 상태가 사라져요.
      const patched = config.strategy === 'response' && j === 0;
      const visible = patched || target === 'primary' || caughtUp(target);

      reads += 1;
      if (target === 'primary') primaryReads += 1;
      if (j === 0 && !visible) firstMisses += 1;
      if (previousVisible === true && !visible) regressions += 1;
      previousVisible = visible;
    }
  }

  return {
    sessions: SESSIONS,
    firstMisses,
    firstMissRatio: firstMisses / SESSIONS,
    regressions,
    reads,
    primaryReads,
    primaryShare: primaryReads / reads,
    primaryPerSec: primaryReads / (horizonMs / 1000),
    lagP95Ms: Math.round(percentile(lagSamples, 0.95)),
  };
}

/** 같은 조건에서 다섯 전략을 모두 돌려 나란히 보여 줘요 */
export function compareStrategies(config: Omit<Config, 'strategy'>): readonly { id: Strategy; result: Result }[] {
  return STRATEGIES.map((s) => ({ id: s.id, result: simulate({ ...config, strategy: s.id }) }));
}
