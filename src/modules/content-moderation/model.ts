/** 신고가 들어오는 대상. violating 은 실제 정책 위반 글, legit 은 정상 글이에요 */
export type Target = 'violating' | 'legit';
export type QueueMode = 'select' | 'skip';

export const QUEUE_MODES: readonly QueueMode[] = ['select', 'skip'];
export const QUEUE_LABEL: Record<QueueMode, string> = {
  select: '일반 SELECT',
  skip: 'FOR UPDATE SKIP LOCKED',
};

export const HORIZON = 40;
/** 검수 한 건을 끝내는 데 걸리는 틱 수 (예시) */
export const REVIEW_TICKS = 2;
/** 실제 신고자가 신고를 시작하는 시간 범위 (예시) */
const GENUINE_SPAN = 12;
/** 조직적 신고는 짧은 시간에 몰려요 (예시) */
const BRIGADE_SPAN = 4;
/** 대기열에 이미 있던 항목의 집계 수는 임계값부터 이만큼 위에 있어요 (예시) */
const BACKLOG_EXTRA = 5;

export interface Params {
  /** 정책 위반 글 하나를 신고하는 실제 사용자 수 */
  readonly reporters: number;
  /** 신고 한 번당 다시 보내는 횟수. 버튼 두 번 클릭이나 네트워크 재시도를 뜻해요 */
  readonly retries: number;
  /** (신고자, 대상) 유니크 제약을 쓰면 true. 같은 사람의 중복 신고를 한 번만 셉니다 */
  readonly dedupe: boolean;
  /** 자동 숨김 임계값. 집계 수가 이 값에 닿으면 숨겨요 */
  readonly threshold: number;
  /** 정상 글 하나에 몰리는 조직적 신고 계정 수. 계정은 모두 달라요 */
  readonly brigade: number;
  readonly reviewers: number;
  readonly queue: QueueMode;
  /** 이미 검수 대기열에 있던 항목 수 */
  readonly backlog: number;
  readonly seed: number;
}

export interface QueueItem {
  readonly id: string;
  readonly target: Target | 'backlog';
  readonly priority: number;
  readonly hideAt: number;
  decided: boolean;
  decidedAt?: number;
  lockedBy?: number;
}

export interface Result {
  /** 대상별 집계 수 (중복 제외 여부는 dedupe 에 따라 달라요) */
  readonly counted: Readonly<Record<Target, number>>;
  /** 대상별 자동 숨김 시점. 임계값에 못 미치면 undefined */
  readonly hideAt: Readonly<Record<Target, number | undefined>>;
  /** 같은 사람의 중복 신고 중 집계에 들어간 수 */
  readonly duplicateCounted: number;
  /** 유니크 제약이 막은 중복 신고 수 */
  readonly duplicateBlocked: number;
  /** 정상 글이 자동으로 숨겨진 수 */
  readonly falseHides: number;
  /** 같은 항목을 검수자 두 명 이상이 처리한 횟수 */
  readonly doubleReviewed: number;
  /** 정책 위반 글의 검수가 끝난 시점 */
  readonly violatingDecidedAt: number | undefined;
}

/** 시드가 같으면 같은 흐름이 나오도록 하는 난수 생성기 */
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

interface Submission {
  readonly tick: number;
  readonly target: Target;
  readonly actor: string;
}

/**
 * 신고 제출을 시각순으로 만들어요. 실제 신고자, 조직적 신고 계정, 대기열 항목은
 * 각자 다른 시드를 써서, 슬라이더 하나를 바꿔도 나머지 흐름이 흔들리지 않아요.
 */
function buildSubmissions(p: Params): Submission[] {
  const genuineRnd = mulberry32(p.seed);
  const brigadeRnd = mulberry32(p.seed + 7919);
  const subs: Submission[] = [];

  for (let i = 0; i < p.reporters; i++) {
    const start = Math.floor(genuineRnd() * GENUINE_SPAN);
    for (let k = 0; k <= p.retries; k++) {
      subs.push({ tick: start + k, target: 'violating', actor: `user-${i}` });
    }
  }
  for (let j = 0; j < p.brigade; j++) {
    const tick = Math.floor(brigadeRnd() * BRIGADE_SPAN);
    subs.push({ tick, target: 'legit', actor: `account-${j}` });
  }

  return subs.sort((a, b) => a.tick - b.tick || a.target.localeCompare(b.target) || a.actor.localeCompare(b.actor));
}

/**
 * 한 틱은 한 시점이에요. 같은 틱에서 검수자들은 틱 시작 때 보이던 대기열을 함께 봐요.
 * select 는 잠금이 없어서 진행 중인 항목도 "아직 안 끝난 항목"으로 다시 골라요.
 * skip 은 잡힌 항목을 건너뛰어서 두 검수자가 같은 항목을 잡지 않아요.
 */
export function simulate(p: Params): Result {
  const subs = buildSubmissions(p);
  const counted: Record<Target, number> = { violating: 0, legit: 0 };
  const hideAt: Record<Target, number | undefined> = { violating: undefined, legit: undefined };
  const seen = new Set<string>();
  let duplicateCounted = 0;
  let duplicateBlocked = 0;

  for (const s of subs) {
    const key = `${s.target}:${s.actor}`;
    const repeat = seen.has(key);
    seen.add(key);
    if (repeat && p.dedupe) {
      duplicateBlocked += 1;
      continue;
    }
    if (repeat) duplicateCounted += 1;
    counted[s.target] += 1;
    if (hideAt[s.target] === undefined && counted[s.target] >= p.threshold) {
      hideAt[s.target] = s.tick;
    }
  }

  const backlogRnd = mulberry32(p.seed + 104729);
  const items: QueueItem[] = [];
  for (let b = 0; b < p.backlog; b++) {
    items.push({
      id: `backlog-${b}`,
      target: 'backlog',
      priority: p.threshold + Math.floor(backlogRnd() * BACKLOG_EXTRA),
      hideAt: 0,
      decided: false,
    });
  }
  for (const target of ['violating', 'legit'] as const) {
    const at = hideAt[target];
    if (at !== undefined) {
      items.push({ id: target, target, priority: counted[target], hideAt: at, decided: false });
    }
  }

  const reviewers = Array.from({ length: p.reviewers }, () => ({
    current: undefined as QueueItem | undefined,
    busyUntil: -1,
  }));
  let doubleReviewed = 0;

  const byPriority = (a: QueueItem, b: QueueItem) => b.priority - a.priority || a.id.localeCompare(b.id);

  for (let t = 0; t <= HORIZON; t++) {
    reviewers.forEach((r, idx) => {
      if (!r.current || r.busyUntil !== t) return;
      const item = r.current;
      if (item.decided) doubleReviewed += 1;
      else {
        item.decided = true;
        item.decidedAt = t;
      }
      if (item.lockedBy === idx) item.lockedBy = undefined;
      r.current = undefined;
    });

    reviewers.forEach((r, idx) => {
      if (r.current) return;
      const pick = items
        .filter((it) => it.hideAt <= t && !it.decided && (p.queue === 'select' || it.lockedBy === undefined))
        .sort(byPriority)[0];
      if (!pick) return;
      r.current = pick;
      r.busyUntil = t + REVIEW_TICKS;
      if (p.queue === 'skip') pick.lockedBy = idx;
    });
  }

  return {
    counted,
    hideAt,
    duplicateCounted,
    duplicateBlocked,
    falseHides: hideAt.legit === undefined ? 0 : 1,
    doubleReviewed,
    violatingDecidedAt: items.find((it) => it.target === 'violating')?.decidedAt,
  };
}
