/**
 * 검색 색인 반영 모델 — 순수 함수.
 * 시간 단위는 초이고, 0초에 사용자가 상품 이름을 저장한다고 가정해요.
 * 실제 측정값이 아니라 감을 잡기 위한 예시예요.
 */

/** 이중 쓰기: 앱이 DB 저장 뒤 색인을 직접 써요. 아웃박스 · CDC: DB 변경을 따로 흘려 보내 색인을 써요. */
export type Mode = 'dual-write' | 'outbox' | 'cdc';

/** 저장한 작업. rename 은 이름 변경, delete 는 상품 삭제 */
export type Op = 'rename' | 'delete';

/** 값의 세 상태. gone 은 문서가 없는 상태 */
export type Value = 'old' | 'new' | 'gone';

export interface Config {
  mode: Mode;
  op: Op;
  /** 아웃박스 발행 또는 CDC 캡처가 늦는 시간(초). 이중 쓰기에는 쓰지 않아요 */
  delay: number;
  /** 색인 refresh 간격(초). 쓴 값은 다음 refresh 때 검색에 보여요 */
  refresh: number;
  /** 색인 쓰기를 처음 몇 번 실패시킬지 */
  failCount: number;
  /** 실패하면 다시 시도하는지 */
  retry: boolean;
  /** 전체 재색인을 시작하는 시각(초). null 이면 하지 않아요 */
  reindexAt: number | null;
}

export const HORIZON = 120;
export const RETRY_EVERY = 5;
export const REINDEX_TAKES = 30;
const MAX_ATTEMPTS = 10;

export interface Attempt {
  at: number;
  ok: boolean;
}

export interface VisibleEvent {
  /** 검색에 보이기 시작하는 시각 */
  at: number;
  value: Value;
  kind: 'write' | 'reindex';
}

export interface SeriesPoint {
  t: number;
  db: Value;
  search: Value;
  same: boolean;
}

export interface Outcome {
  attempts: Attempt[];
  visible: VisibleEvent[];
  series: SeriesPoint[];
  /** 이 시각부터 끝까지 DB 와 검색 결과가 같아요. null 이면 끝까지 달라요 */
  syncedFrom: number | null;
}

const ceilToRefresh = (t: number, refresh: number) => Math.ceil(t / refresh) * refresh;

const finalValue = (op: Op): Value => (op === 'rename' ? 'new' : 'gone');

/** 0초 이전에는 옛 값, 그 뒤에는 저장한 값이에요 */
export const dbValueAt = (config: Config, t: number): Value => (t < 0 ? 'old' : finalValue(config.op));

const firstAttemptAt = (config: Config) => (config.mode === 'dual-write' ? 0 : config.delay);

/** 색인 쓰기 시도 시각 목록. 실패하면 RETRY_EVERY 초 뒤에 다시 쳐요 */
export function attemptsOf(config: Config): Attempt[] {
  const attempts: Attempt[] = [];
  const start = firstAttemptAt(config);
  const limit = config.retry ? MAX_ATTEMPTS : 1;
  for (let k = 0; k < limit; k++) {
    const at = start + k * RETRY_EVERY;
    const ok = k >= config.failCount;
    attempts.push({ at, ok });
    if (ok) break;
  }
  return attempts;
}

/** 검색에 보이기 시작하는 사건들. 색인 쓰기는 성공한 시각을 다음 refresh 에 맞춰요 */
export function visibleEventsOf(config: Config): VisibleEvent[] {
  const events: VisibleEvent[] = [];
  const success = attemptsOf(config).find((a) => a.ok);
  if (success) {
    events.push({
      at: ceilToRefresh(success.at, config.refresh),
      value: finalValue(config.op),
      kind: 'write',
    });
  }
  if (config.reindexAt !== null) {
    const swapAt = config.reindexAt + REINDEX_TAKES;
    events.push({
      at: ceilToRefresh(swapAt, config.refresh),
      value: dbValueAt(config, swapAt),
      kind: 'reindex',
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

/** t 시각에 검색이 보여 주는 값. 아무 사건도 보이지 않았다면 옛 값이에요 */
export function searchValueAt(visible: VisibleEvent[], t: number): Value {
  let value: Value = 'old';
  for (const e of visible) {
    if (e.at <= t) value = e.value;
  }
  return value;
}

export function simulate(config: Config): Outcome {
  const attempts = attemptsOf(config);
  const visible = visibleEventsOf(config);
  const series: SeriesPoint[] = [];
  for (let t = 0; t <= HORIZON; t++) {
    const db = dbValueAt(config, t);
    const search = searchValueAt(visible, t);
    series.push({ t, db, search, same: db === search });
  }

  let syncedFrom: number | null = null;
  if (series[series.length - 1].same) {
    let i = series.length - 1;
    while (i > 0 && series[i - 1].same) i--;
    syncedFrom = series[i].t;
  }

  return { attempts, visible, series, syncedFrom };
}

export const VALUE_LABEL: Record<Value, string> = {
  old: '옛 이름',
  new: '새 이름',
  gone: '없음',
};

export interface Preset {
  id: string;
  label: string;
  config: Config;
}

const BASE: Config = {
  mode: 'outbox',
  op: 'rename',
  delay: 2,
  refresh: 1,
  failCount: 0,
  retry: true,
  reindexAt: null,
};

export const PRESETS: Preset[] = [
  { id: 'outbox-basic', label: '아웃박스 · 발행 2초 · refresh 1초', config: BASE },
  {
    id: 'dual-fail-no-retry',
    label: '이중 쓰기 · 색인 쓰기 1번 실패 · 재시도 없음',
    config: { ...BASE, mode: 'dual-write', failCount: 1, retry: false },
  },
  {
    id: 'dual-fail-retry',
    label: '이중 쓰기 · 색인 쓰기 1번 실패 · 재시도 있음',
    config: { ...BASE, mode: 'dual-write', failCount: 1, retry: true },
  },
  {
    id: 'cdc-slow-refresh',
    label: 'CDC · 캡처 8초 · refresh 30초',
    config: { ...BASE, mode: 'cdc', delay: 8, refresh: 30 },
  },
  {
    id: 'outbox-delete',
    label: '아웃박스 · 상품 삭제 반영',
    config: { ...BASE, op: 'delete' },
  },
  {
    id: 'dual-fail-reindex',
    label: '이중 쓰기 실패 뒤 전체 재색인 (60초에 시작)',
    config: { ...BASE, mode: 'dual-write', failCount: 1, retry: false, reindexAt: 60 },
  },
];

export const MODE_LABEL: Record<Mode, string> = {
  'dual-write': '이중 쓰기',
  outbox: '아웃박스',
  cdc: 'CDC',
};

export const OP_LABEL: Record<Op, string> = {
  rename: '이름 변경',
  delete: '상품 삭제',
};

export interface Verdict {
  tone: 'success' | 'warning' | 'error';
  title: string;
  reason: string;
}

/** 결과 카드와 판정 문구. 수치는 모델의 예시값이에요 */
export function verdictOf(config: Config, outcome: Outcome): Verdict {
  const { syncedFrom } = outcome;

  if (syncedFrom === null) {
    const reason =
      config.mode === 'dual-write'
        ? '이중 쓰기는 DB 저장과 색인 쓰기가 따로 일어나요. 색인 쓰기가 실패하고 다시 보내지 않으면 아무도 옛 값을 고치지 않아요.'
        : '실패한 색인 쓰기를 다시 보내는 장치가 없어요. 재시도나 전체 재색인이 있어야 값이 맞아요.';
    return {
      tone: 'error',
      title: `${HORIZON}초가 지나도 검색 결과가 DB 와 달라요. 영구 불일치예요.`,
      reason,
    };
  }

  const usedReindex = outcome.visible.some((e) => e.kind === 'reindex' && e.at === syncedFrom);
  if (usedReindex) {
    return {
      tone: 'success',
      title: `${syncedFrom}초 뒤부터 검색 결과가 DB 와 같아요.`,
      reason: '전체 재색인으로 새 인덱스를 채우고 별칭을 바꿔서 옛 값이 정리됐어요.',
    };
  }

  if (syncedFrom === 0) {
    return { tone: 'success', title: '처음부터 검색 결과가 DB 와 같아요.', reason: '지연이 없어요.' };
  }

  const reasons: string[] = [];
  if (config.mode !== 'dual-write') {
    reasons.push(`발행 또는 캡처에 ${config.delay}초가 걸려요.`);
  }
  if (config.refresh > 1) {
    reasons.push(`색인 refresh 가 ${config.refresh}초마다 돌아서 쓴 값이 그 시각까지 검색에 안 보여요.`);
  }
  if (config.failCount > 0) {
    reasons.push(`색인 쓰기 ${config.failCount}번 실패 뒤 재시도로 맞췄어요.`);
  }
  return {
    tone: syncedFrom <= 5 ? 'success' : 'warning',
    title: `${syncedFrom}초 뒤부터 검색 결과가 DB 와 같아요.`,
    reason: reasons.join(' ') || '쓰기가 바로 반영되고 다음 refresh 에 검색에 보여요.',
  };
}
