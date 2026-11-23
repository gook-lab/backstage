/** 기록을 어디에 남기는지: 현재 값만 · 이력 테이블(스냅샷) · 이벤트 기록 */
export type RecordMode = 'current' | 'snapshot' | 'event';

/** 이력을 누가 쓰는지: 앱 코드 · DB 트리거 */
export type CaptureSite = 'app' | 'trigger';

export type ActionKind = 'create' | 'edit' | 'delete' | 'restore' | 'direct-edit';

export interface ProductState {
  readonly price: number;
  readonly deleted: boolean;
}

/** 상품 하나에 일어난 동작 한 번. direct-edit 는 앱을 거치지 않고 DB에서 직접 고친 값이에요 */
export interface Step {
  readonly kind: ActionKind;
  readonly price?: number;
  readonly actor: string;
  /** UTC 시각. 저장과 비교는 이 값으로 해요 */
  readonly at: string;
  /** 앱 요청 id. DB에서 직접 바꾼 값에는 없어요 */
  readonly requestId: string | null;
}

/** 이력 한 줄. snapshot 에는 after 만, event 에는 행위와 이전 값, 요청 id 까지 남아요 */
export interface HistoryEntry {
  readonly at: string;
  readonly actor: string;
  readonly after: ProductState;
  readonly kind?: ActionKind;
  readonly before?: ProductState;
  readonly requestId?: string | null;
}

export interface Run {
  /** 각 동작 직후의 실제 값 */
  readonly truth: readonly ProductState[];
  /** 기록 방식과 기록 위치에 따라 남은 이력. 시각 오름차순 */
  readonly history: readonly HistoryEntry[];
  /** 기록에서 빠진 동작 수 (current 에서는 세지 않아요) */
  readonly missed: number;
}

export type RestoreStatus = 'exact' | 'stale' | 'lost';

export interface Restore {
  readonly status: RestoreStatus;
  /** exact 와 stale 에서 이력이 준 값. lost 에서는 null */
  readonly value: ProductState | null;
}

export const CREATE_PRICE = 1000;
export const BASE_AT = Date.UTC(2026, 10, 22, 6, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

export const stepAt = (index: number): string => new Date(BASE_AT + index * HOUR_MS).toISOString();

export const KIND_LABEL: Record<ActionKind, string> = {
  create: '처음 등록',
  edit: '가격 편집',
  delete: '삭제',
  restore: '복구',
  'direct-edit': 'DB에서 직접 수정',
};

/** 화면 버튼 목록. 가격이 없는 동작은 price 를 주지 않아요 */
export const ACTIONS: readonly { id: string; label: string; kind: ActionKind; price?: number }[] = [
  { id: 'edit-1200', label: '가격 1,200원으로 편집', kind: 'edit', price: 1200 },
  { id: 'edit-900', label: '가격 900원으로 편집', kind: 'edit', price: 900 },
  { id: 'delete', label: '삭제', kind: 'delete' },
  { id: 'restore', label: '복구', kind: 'restore' },
  { id: 'direct-1500', label: 'DB에서 직접 1,500원으로 수정', kind: 'direct-edit', price: 1500 },
];

export function makeStep(kind: ActionKind, index: number, price?: number): Step {
  const direct = kind === 'direct-edit';
  return {
    kind,
    price,
    actor: direct ? 'db-operator' : 'admin-17',
    at: stepAt(index),
    requestId: direct ? null : `req-${index}`,
  };
}

/** 편집 · 삭제 · 복구 · 직접 수정이 섞인 예시 순서 */
export function presetSteps(): Step[] {
  const create = makeStep('create', 0, CREATE_PRICE);
  return [create, ...ACTIONS.map((a, i) => makeStep(a.kind, i + 1, a.price))];
}

export function applyStep(prev: ProductState, step: Step): ProductState {
  switch (step.kind) {
    case 'create':
      return { price: step.price ?? prev.price, deleted: false };
    case 'edit':
    case 'direct-edit':
      return { price: step.price ?? prev.price, deleted: prev.deleted };
    case 'delete':
      return { price: prev.price, deleted: true };
    case 'restore':
      return { price: prev.price, deleted: false };
  }
}

/** 앱 코드 기록은 앱 요청에서만 돌아요. DB 트리거는 모든 쓰기에서 돌아요 */
export const isRecorded = (step: Step, site: CaptureSite): boolean => step.kind !== 'direct-edit' || site === 'trigger';

export function run(steps: readonly Step[], mode: RecordMode, site: CaptureSite): Run {
  const truth: ProductState[] = [];
  const history: HistoryEntry[] = [];
  let prev: ProductState = { price: 0, deleted: false };
  let missed = 0;

  for (const step of steps) {
    const before = prev;
    const after = applyStep(prev, step);
    prev = after;
    truth.push(after);

    if (mode === 'current') continue;
    if (!isRecorded(step, site)) {
      missed += 1;
      continue;
    }
    history.push(
      mode === 'event'
        ? {
            at: step.at,
            actor: step.actor,
            kind: step.kind,
            before: step.kind === 'create' ? undefined : before,
            after,
            requestId: step.requestId,
          }
        : { at: step.at, actor: step.actor, after },
    );
  }

  return { truth, history, missed };
}

const same = (a: ProductState, b: ProductState) => a.price === b.price && a.deleted === b.deleted;

/** index 번째 동작 직후 값을 이력만으로 되돌릴 수 있는지 판정해요 */
export function restoreAt(result: Run, steps: readonly Step[], mode: RecordMode, index: number): Restore {
  const actual = result.truth[index];
  if (mode === 'current') {
    return index === result.truth.length - 1 ? { status: 'exact', value: actual } : { status: 'lost', value: null };
  }

  const at = Date.parse(steps[index].at);
  let found: HistoryEntry | undefined;
  for (const entry of result.history) {
    if (Date.parse(entry.at) <= at) found = entry;
  }
  if (!found) return { status: 'lost', value: null };

  return { status: same(found.after, actual) ? 'exact' : 'stale', value: found.after };
}
