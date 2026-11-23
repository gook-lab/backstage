export type Restart = 'scratch' | 'checkpoint';

export const RESTARTS: readonly Restart[] = ['scratch', 'checkpoint'];
export const RESTART_LABEL: Record<Restart, string> = {
  scratch: '처음부터 다시',
  checkpoint: '체크포인트부터 이어서',
};

/** 청크를 커밋할 때 드는 시간(틱). 시뮬레이터의 시간 단위예요 */
export const COMMIT_TICKS = 3;
/** 실패한 워커가 다시 뜨기까지 걸리는 시간(틱) */
export const RESTART_TICKS = 5;

export interface Params {
  /** 정산 대상 건수 */
  readonly total: number;
  /** 청크 크기: 한 번 커밋하는 건수 */
  readonly chunk: number;
  /** 중간 실패를 일으킬지 */
  readonly crash: boolean;
  /** 실패 지점: 정산 대상의 몇 % 를 처리한 뒤 워커가 죽는지 (0 초과 100 이하) */
  readonly crashPct: number;
  readonly restart: Restart;
  /** 이미 정산된 건을 건너뛰는지 (멱등 처리) */
  readonly idempotent: boolean;
  /** 같은 배치가 두 번 돌지 않게 잠그는지 */
  readonly lock: boolean;
  /** 두 번째 실행(중복 클릭 · 두 번째 워커)이 같은 시각에 시작하는지 */
  readonly rival: boolean;
  readonly seed: number;
}

export interface Result {
  /** 모든 실행이 끝날 때까지 걸린 틱 */
  readonly totalTicks: number;
  /** 틱별로 한 번이라도 정산된 건수 (중복 제외) */
  readonly doneByTick: readonly number[];
  /** 건별로 외부 정산 호출이 나간 횟수 */
  readonly applied: readonly number[];
  /** 같은 건을 한 번 더 정산한 건수 (중복 정산) */
  readonly duplicates: number;
  /** 이미 본 건을 다시 본 횟수 (멱등이면 건너뛰기도 포함) */
  readonly revisits: number;
  /** 끝까지 정산되지 않은 건수 */
  readonly missing: number;
  /** 실패 뒤 다시 시작한 건 번호. 실패가 없었으면 null */
  readonly resumeFrom: number | null;
  /** 실패가 난 틱. 없으면 null */
  readonly crashTick: number | null;
  /** 거절된 두 번째 실행 수 (잠금이 켜져 있을 때) */
  readonly rejectedRuns: number;
}

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

interface Run {
  readonly id: string;
  /** 다음에 볼 건 번호 */
  next: number;
  /** 지금 청크가 끝나는 건 번호(이 번호 직전까지가 한 커밋) */
  chunkEnd: number;
  /** 이 틱까지는 바빠서 다음 건을 보지 않아요 */
  busyUntil: number;
  alive: boolean;
  done: boolean;
  /** 이 실행이 처리한 건수가 여기에 닿으면 워커가 죽어요 */
  readonly crashAt: number | null;
  processed: number;
}

/**
 * 한 틱에 실행 하나가 건 하나를 봐요. 건마다 외부 호출 시간이 1 또는 2 틱이고,
 * 시드로 정해진 값이라 같은 시드는 항상 같은 결과를 내요.
 * 청크가 끝나면 체크포인트를 커밋하고, 커밋 전에 죽은 부분은 다시 처리해야 해요.
 */
export function simulate(p: Params): Result {
  const rnd = mulberry32(p.seed);
  const latency = Array.from({ length: p.total }, () => (rnd() < 0.25 ? 2 : 1));
  const applied: number[] = new Array(p.total).fill(0);

  let checkpoint = 0;
  let distinct = 0;
  let duplicates = 0;
  let revisits = 0;
  let rejectedRuns = 0;
  let resumeFrom: number | null = null;
  let crashTick: number | null = null;

  const crashAt = p.crash ? Math.min(p.total, Math.max(1, Math.floor((p.total * p.crashPct) / 100))) : null;

  const startRun = (id: string, from: number, tick: number, at: number | null): Run => ({
    id,
    next: from,
    chunkEnd: Math.min(from + p.chunk, p.total),
    busyUntil: tick,
    alive: true,
    done: false,
    crashAt: at,
    processed: 0,
  });

  const runs: Run[] = [startRun('A', 0, 0, crashAt)];
  if (p.rival) {
    if (p.lock) rejectedRuns = 1;
    else runs.push(startRun('B', 0, 0, null));
  }

  const doneByTick: number[] = [];
  const LIMIT = p.total * 10 + 100;
  let t = 0;

  for (; t < LIMIT; t++) {
    // 루프 중에 실패 뒤의 새 실행이 붙을 수 있어서 길이를 매번 확인해요
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      if (!r.alive || r.done || r.busyUntil > t) continue;

      if (r.next >= p.total) {
        r.done = true;
        continue;
      }

      const i = r.next;
      if (applied[i] === 0) {
        applied[i] = 1;
        distinct += 1;
        r.busyUntil = t + latency[i];
      } else {
        revisits += 1;
        if (p.idempotent) {
          r.busyUntil = t + 1;
        } else {
          applied[i] += 1;
          duplicates += 1;
          r.busyUntil = t + latency[i];
        }
      }
      r.next += 1;
      r.processed += 1;

      if (r.crashAt !== null && r.processed === r.crashAt) {
        r.alive = false;
        crashTick = t;
        const from = p.restart === 'scratch' ? 0 : checkpoint;
        resumeFrom = from;
        runs.push(startRun(`${r.id}'`, from, t + RESTART_TICKS, null));
        continue;
      }

      if (r.next === r.chunkEnd || r.next === p.total) {
        checkpoint = Math.max(checkpoint, r.next);
        r.busyUntil += COMMIT_TICKS;
        r.chunkEnd = Math.min(r.next + p.chunk, p.total);
      }
    }

    doneByTick.push(distinct);
    const active = runs.some((r) => r.alive && !r.done);
    if (!active) break;
  }

  const missing = applied.filter((n) => n === 0).length;

  return {
    totalTicks: t,
    doneByTick,
    applied,
    duplicates,
    revisits,
    missing,
    resumeFrom,
    crashTick,
    rejectedRuns,
  };
}
