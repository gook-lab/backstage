export type Strategy = 'none' | 'if-match' | 'version';
export type Order = 'seq' | 'a-first' | 'b-first';
export type UserId = 'A' | 'B';
export type Status = 200 | 409 | 412 | 428;

export const STRATEGIES: readonly Strategy[] = ['none', 'if-match', 'version'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  none: '조건 없음 · 마지막 저장 우선',
  'if-match': 'If-Match · ETag 비교',
  version: '버전 칼럼 · WHERE 조건',
};

export const ORDERS: readonly Order[] = ['seq', 'a-first', 'b-first'];
export const ORDER_LABEL: Record<Order, string> = {
  seq: '한 명씩 읽고 저장',
  'a-first': '둘이 먼저 읽고 A가 먼저 저장',
  'b-first': '둘이 먼저 읽고 B가 먼저 저장',
};

export const START_BODY = '초안';

export interface Params {
  readonly strategy: Strategy;
  readonly order: Order;
  /** If-Match 전략에서 조건 헤더가 없는 저장을 428 로 거절할지 */
  readonly requireIfMatch: boolean;
  /** B 의 저장 요청이 If-Match 헤더를 빠뜨렸는지 (FE 버그 흉내) */
  readonly omitIfMatchB: boolean;
}

export interface Step {
  readonly user: UserId;
  readonly kind: 'read' | 'save';
}

export const ORDER_STEPS: Record<Order, readonly Step[]> = {
  seq: [
    { user: 'A', kind: 'read' },
    { user: 'A', kind: 'save' },
    { user: 'B', kind: 'read' },
    { user: 'B', kind: 'save' },
  ],
  'a-first': [
    { user: 'A', kind: 'read' },
    { user: 'B', kind: 'read' },
    { user: 'A', kind: 'save' },
    { user: 'B', kind: 'save' },
  ],
  'b-first': [
    { user: 'A', kind: 'read' },
    { user: 'B', kind: 'read' },
    { user: 'B', kind: 'save' },
    { user: 'A', kind: 'save' },
  ],
};

export interface SaveResult {
  readonly step: number;
  readonly user: UserId;
  /** 보낸 조건. none 은 조건이 없고, 나머지는 읽은 버전이에요 */
  readonly sent: string;
  readonly status: Status;
  /** 응답 뒤 서버에 남은 버전 */
  readonly versionAfter: number;
  /** 읽은 뒤 남이 먼저 고친 값을 덮어쓴 저장 (lost update) */
  readonly stale: boolean;
}

export interface Result {
  /** 읽기와 저장을 포함한 진행 순서 */
  readonly steps: readonly (Step & { readonly index: number; readonly seen?: number })[];
  readonly saves: readonly SaveResult[];
  readonly finalBody: string;
  readonly finalVersion: number;
  /** 성공한 저장 중 나중 저장에 덮인 수 */
  readonly lost: number;
  readonly conflicts: number;
}

export function editOf(user: UserId): string {
  return `${user}의 수정`;
}

export function simulate(p: Params): Result {
  let doc = { body: START_BODY, version: 1 };
  const seen: Partial<Record<UserId, number>> = {};
  const saves: SaveResult[] = [];
  const steps: (Step & { index: number; seen?: number })[] = [];

  ORDER_STEPS[p.order].forEach((s, index) => {
    if (s.kind === 'read') {
      seen[s.user] = doc.version;
      steps.push({ ...s, index, seen: doc.version });
      return;
    }
    steps.push({ ...s, index });
    const readVersion = seen[s.user] ?? doc.version;
    const omits = p.omitIfMatchB && s.user === 'B';
    let status: Status;
    let sent: string;

    if (p.strategy === 'none') {
      status = 200;
      sent = '없음';
    } else if (p.strategy === 'if-match') {
      if (omits) {
        sent = '없음';
        status = p.requireIfMatch ? 428 : 200;
      } else {
        sent = `"v${readVersion}"`;
        status = readVersion === doc.version ? 200 : 412;
      }
    } else {
      sent = `version = ${readVersion}`;
      status = readVersion === doc.version ? 200 : 409;
    }

    const stale = status === 200 && readVersion !== doc.version;
    if (status === 200) {
      doc = { body: editOf(s.user), version: doc.version + 1 };
    }
    saves.push({ step: index, user: s.user, sent, status, versionAfter: doc.version, stale });
  });

  const lost = saves.filter((r) => r.stale).length;
  const conflicts = saves.filter((r) => r.status !== 200).length;

  return {
    steps,
    saves,
    finalBody: doc.body,
    finalVersion: doc.version,
    lost,
    conflicts,
  };
}
