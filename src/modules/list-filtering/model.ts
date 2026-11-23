/**
 * 주문 목록 질의의 실행 비용을 설명하는 순수 모델.
 * 실제 DB 가 아니에요. 행 수는 모두 예시이고, 플래너의 선택 규칙을 단순하게 옮긴 것이에요.
 */

export const TOTAL_ROWS = 1_000_000;
export const LIMIT = 20;
export const COUNT_CAP = 1000;

export const STATUSES = ['all', 'pending', 'shipping', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  all: '전체',
  pending: '결제 대기',
  shipping: '배송 중',
  done: '완료',
};
/** 상태별 예시 행 수. 합이 TOTAL_ROWS 와 같아요. */
export const STATUS_ROWS: Record<Status, number> = {
  all: TOTAL_ROWS,
  pending: 20_000,
  shipping: 80_000,
  done: 900_000,
};

export const PERIODS = ['7d', '90d', 'all'] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = {
  '7d': '최근 7일',
  '90d': '최근 90일',
  all: '전체 기간',
};
export const PERIOD_ROWS: Record<Period, number> = {
  '7d': 20_000,
  '90d': 250_000,
  all: TOTAL_ROWS,
};

export const SORTS = ['created', 'amount'] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = {
  created: '최신순 (created_at DESC)',
  amount: '금액순 (amount DESC)',
};

export const INDEXES = ['none', 'created', 'status-created', 'created-status', 'partial-pending'] as const;
export type IndexDef = (typeof INDEXES)[number];
export const INDEX_LABEL: Record<IndexDef, string> = {
  none: '인덱스 없음',
  created: '(created_at)',
  'status-created': '(status, created_at)',
  'created-status': '(created_at, status)',
  'partial-pending': "(created_at) WHERE status = 'pending'",
};

export const COUNT_MODES = ['exact', 'cap', 'has-next', 'estimate'] as const;
export type CountMode = (typeof COUNT_MODES)[number];
export const COUNT_LABEL: Record<CountMode, string> = {
  exact: '정확한 COUNT(*)',
  cap: '1,000건 이상 표시',
  'has-next': '다음 페이지 여부만',
  estimate: '통계 기반 추정치',
};

export interface Query {
  readonly status: Status;
  readonly period: Period;
  readonly sort: Sort;
  readonly index: IndexDef;
}

export interface Plan {
  /** 접근 방식 한 줄 설명 */
  access: string;
  usesIndex: boolean;
  /** 인덱스 항목을 몇 개 훑었는지 */
  indexEntries: number;
  /** 테이블 행을 몇 번 방문했는지 */
  tableRows: number;
  /** 정렬 단계가 필요한지 */
  sortNeeded: boolean;
  /** 정렬 단계가 읽는 행 수 (정렬 없으면 0) */
  sortRows: number;
  /** 인덱스 항목 수 (예시). 인덱스가 없으면 0 */
  indexSize: number;
  /** 조건에 맞는 행 수 (예시) */
  matched: number;
}

export function matchedRows(q: Pick<Query, 'status' | 'period'>): number {
  return Math.round((STATUS_ROWS[q.status] * PERIOD_ROWS[q.period]) / TOTAL_ROWS);
}

function seqScan(q: Query, access: string): Plan {
  const matched = matchedRows(q);
  return {
    access,
    usesIndex: false,
    indexEntries: 0,
    tableRows: TOTAL_ROWS,
    sortNeeded: true,
    sortRows: matched,
    indexSize: 0,
    matched,
  };
}

/** 인덱스가 쓰이지 않을 때 쓰는 공통 결과 */
const SEQ = '테이블 전체를 읽어요 (Seq Scan)';
const PARTIAL_MISS = '부분 인덱스 조건을 쿼리가 함의하지 않아 쓸 수 없어요. 테이블 전체를 읽어요';

/** 최신순 정렬에서 created_at 역방향으로 LIMIT 건이 차면 멈추는 스캔 길이 */
function walkLength(q: Query): number {
  const byPeriod = PERIOD_ROWS[q.period];
  const toFill = Math.ceil((LIMIT * TOTAL_ROWS) / STATUS_ROWS[q.status]);
  return Math.min(byPeriod, toFill);
}

export function plan(q: Query): Plan {
  const matched = matchedRows(q);

  if (q.index === 'none') return seqScan(q, SEQ);

  if (q.sort === 'amount') {
    // 금액 인덱스가 없으므로 어떤 인덱스를 쓰든 정렬 단계가 남아요
    switch (q.index) {
      case 'created':
        return {
          access: 'created_at 범위만 스캔하고 나머지는 금액으로 정렬해요',
          usesIndex: true,
          indexEntries: PERIOD_ROWS[q.period],
          tableRows: PERIOD_ROWS[q.period],
          sortNeeded: true,
          sortRows: matched,
          indexSize: TOTAL_ROWS,
          matched,
        };
      case 'created-status':
        return {
          access: '범위와 상태를 인덱스 안에서 확인하고, 맞는 행만 읽어 금액으로 정렬해요',
          usesIndex: true,
          indexEntries: PERIOD_ROWS[q.period],
          tableRows: matched,
          sortNeeded: true,
          sortRows: matched,
          indexSize: TOTAL_ROWS,
          matched,
        };
      case 'status-created': {
        const specific = q.status !== 'all';
        return {
          access: specific
            ? '상태 등호 뒤 created_at 범위를 읽고, 금액으로 정렬해요'
            : '상태 등호 조건이 없어 기간 범위를 넓게 읽고 금액으로 정렬해요',
          usesIndex: true,
          indexEntries: specific ? matched : PERIOD_ROWS[q.period],
          tableRows: specific ? matched : PERIOD_ROWS[q.period],
          sortNeeded: true,
          sortRows: matched,
          indexSize: TOTAL_ROWS,
          matched,
        };
      }
      case 'partial-pending':
        if (q.status !== 'pending') return seqScan(q, PARTIAL_MISS);
        return {
          access: '부분 인덱스에서 기간에 맞는 행을 읽고 금액으로 정렬해요',
          usesIndex: true,
          indexEntries: matched,
          tableRows: matched,
          sortNeeded: true,
          sortRows: matched,
          indexSize: STATUS_ROWS.pending,
          matched,
        };
    }
  }

  // 최신순 (created_at DESC)
  switch (q.index) {
    case 'created': {
      const walk = walkLength(q);
      return {
        access: 'created_at 을 최신부터 거꾸로 읽고, LIMIT 건이 차면 멈춰요',
        usesIndex: true,
        indexEntries: walk,
        tableRows: walk,
        sortNeeded: false,
        sortRows: 0,
        indexSize: TOTAL_ROWS,
        matched,
      };
    }
    case 'created-status': {
      const walk = walkLength(q);
      return {
        access: '상태를 인덱스 안에서 확인하고, 맞는 행만 테이블에서 읽어요',
        usesIndex: true,
        indexEntries: walk,
        tableRows: Math.min(matched, LIMIT),
        sortNeeded: false,
        sortRows: 0,
        indexSize: TOTAL_ROWS,
        matched,
      };
    }
    case 'status-created': {
      if (q.status === 'all') {
        return {
          access: '상태 등호가 없어 기간 범위를 넓게 읽고 정렬해요',
          usesIndex: true,
          indexEntries: PERIOD_ROWS[q.period],
          tableRows: PERIOD_ROWS[q.period],
          sortNeeded: true,
          sortRows: matched,
          indexSize: TOTAL_ROWS,
          matched,
        };
      }
      const walk = Math.min(matched, LIMIT);
      return {
        access: '상태 등호 뒤 created_at 을 거꾸로 읽고, 정렬 단계 없이 LIMIT 건에서 멈춰요',
        usesIndex: true,
        indexEntries: walk,
        tableRows: walk,
        sortNeeded: false,
        sortRows: 0,
        indexSize: TOTAL_ROWS,
        matched,
      };
    }
    case 'partial-pending': {
      if (q.status !== 'pending') return seqScan(q, PARTIAL_MISS);
      const walk = Math.min(matched, LIMIT);
      return {
        access: '부분 인덱스를 최신부터 거꾸로 읽고 LIMIT 건에서 멈춰요',
        usesIndex: true,
        indexEntries: walk,
        tableRows: walk,
        sortNeeded: false,
        sortRows: 0,
        indexSize: STATUS_ROWS.pending,
        matched,
      };
    }
  }
  return seqScan(q, SEQ);
}

export interface CountWork {
  /** 세려고 읽는 행 수 */
  rowsRead: number;
  /** 화면에 보이는 값 (예시) */
  shown: string;
}

export function countWork(q: Pick<Query, 'status' | 'period'>, mode: CountMode): CountWork {
  const matched = matchedRows(q);
  switch (mode) {
    case 'exact':
      return { rowsRead: matched, shown: `${matched.toLocaleString('ko-KR')}개` };
    case 'cap':
      return {
        rowsRead: Math.min(matched, COUNT_CAP + 1),
        shown:
          matched > COUNT_CAP ? `${COUNT_CAP.toLocaleString('ko-KR')}건 이상` : `${matched.toLocaleString('ko-KR')}개`,
      };
    case 'has-next':
      return {
        rowsRead: Math.min(matched, LIMIT + 1),
        shown: matched > LIMIT ? '다음 페이지 있음' : '다음 페이지 없음',
      };
    case 'estimate':
      return { rowsRead: 0, shown: `약 ${(Math.round(matched / 100) * 100).toLocaleString('ko-KR')}개` };
  }
}

export interface FacetWork {
  /** 값마다 COUNT 를 보낼 때 */
  perValue: { queries: number; rowsRead: number };
  /** GROUP BY 한 번으로 셀 때 */
  grouped: { queries: number; rowsRead: number };
}

/** facet 은 결제 대기 · 배송 중 · 완료 세 값을 센다고 가정해요 (예시) */
export const FACET_VALUES = 3;

export function facetWork(q: Pick<Query, 'period' | 'index'>): FacetWork {
  const byPeriod = PERIOD_ROWS[q.period];
  const leadingStatus = q.index === 'status-created';
  return {
    perValue: {
      queries: FACET_VALUES,
      // 상태가 앞 열인 인덱스가 있으면 값마다 자기 행만 읽어요. 없으면 매번 기간 행을 훑어요.
      rowsRead: leadingStatus ? byPeriod : byPeriod * FACET_VALUES,
    },
    grouped: { queries: 1, rowsRead: byPeriod },
  };
}
