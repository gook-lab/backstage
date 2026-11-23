export type Verdict = 'server' | 'client' | 'both';
export type DataSize = 'small' | 'medium' | 'large';

export interface Answers {
  readonly sensitive: boolean;
  readonly dataSize: DataSize;
  readonly shared: boolean;
  readonly instant: boolean;
  readonly heavy: boolean;
  readonly secret: boolean;
  readonly offline: boolean;
}

export const DEFAULT_ANSWERS: Answers = {
  sensitive: false,
  dataSize: 'small',
  shared: false,
  instant: false,
  heavy: false,
  secret: false,
  offline: false,
};

/** server: 서버가 계산한다. client: 클라이언트가 계산한다. preview: 클라이언트가 먼저 보여 준다 */
type Pull = 'server' | 'client' | 'preview';

export interface Rule {
  readonly id: string;
  readonly when: (a: Answers) => boolean;
  readonly pull: Pull;
  /** 값의 진실을 서버가 쥐어야 하는 규칙. 이 규칙이 켜지면 클라이언트 단독 결정은 없어요 */
  readonly authority?: boolean;
  /** 미리보기를 만들면 규칙이 드러나는 경우. 미리보기도 서버가 해요 */
  readonly hiddenFromClient?: boolean;
  readonly reason: string;
  readonly modules: readonly string[];
}

export const RULES: readonly Rule[] = [
  {
    id: 'sensitive',
    when: (a) => a.sensitive,
    pull: 'server',
    authority: true,
    reason: '돈 · 권한 · 재고는 서버가 판단하고 확정해요. 클라이언트가 보낸 값은 참고용으로만 봐요.',
    modules: ['cart-stock', 'payment-idempotency'],
  },
  {
    id: 'shared',
    when: (a) => a.shared,
    pull: 'server',
    authority: true,
    reason: '여러 사람이 동시에 바꾸는 값은 서버 값을 기준으로 해요. 화면은 마지막 서버 응답을 따라요.',
    modules: ['concert-seats', 'hot-counters'],
  },
  {
    id: 'secret',
    when: (a) => a.secret,
    pull: 'server',
    authority: true,
    hiddenFromClient: true,
    reason: '비밀 규칙은 클라이언트에 내려 보내지 않아요. 미리보기를 만들면 규칙이 드러나므로 서버가 계산해요.',
    modules: [],
  },
  {
    id: 'large',
    when: (a) => a.dataSize === 'large',
    pull: 'server',
    reason: '데이터가 커서 클라이언트가 다 받을 수 없어요. 서버가 인덱스로 나눠서 필요한 만큼만 보내요.',
    modules: ['pagination', 'n-plus-one'],
  },
  {
    id: 'small',
    when: (a) => a.dataSize === 'small',
    pull: 'client',
    reason: '50건 안팎이고 이미 받아 둔 목록이면 클라이언트에서 정렬 · 필터해도 충분해요.',
    modules: ['pagination'],
  },
  {
    id: 'instant',
    when: (a) => a.instant,
    pull: 'preview',
    reason: '바로 반응해야 하면 클라이언트가 먼저 보여 줘요. 서버를 치는 입력은 디바운스해서 요청 수를 줄여요.',
    modules: ['cart-stock'],
  },
  {
    id: 'heavy-small',
    when: (a) => a.heavy && a.dataSize === 'small',
    pull: 'client',
    reason: '계산이 무거워도 데이터가 적으면 Web Worker 로 화면 밖에서 돌릴 수 있어요.',
    modules: [],
  },
  {
    id: 'heavy-large',
    when: (a) => a.heavy && a.dataSize !== 'small',
    pull: 'server',
    reason: '계산이 무거운데 데이터가 적지 않으면 저사양 기기가 버티기 어려워요. 서버에서 계산하고 결과만 받아요.',
    modules: ['n-plus-one'],
  },
  {
    id: 'offline',
    when: (a) => a.offline,
    pull: 'client',
    reason: '오프라인에서도 돼야 하면 데이터와 계산을 기기에 둬야 해요. 서버 확정은 연결이 돌아온 뒤로 미뤄요.',
    modules: [],
  },
];

export const VERDICT_LABEL: Record<Verdict, string> = {
  server: '서버에서 처리해요',
  client: '클라이언트에서 처리해요',
  both: '클라이언트가 미리 보여 주고, 서버가 확정해요',
};

export const LINK_LABEL: Readonly<Record<string, string>> = {
  pagination: '페이지네이션 — offset · cursor',
  'n-plus-one': 'N+1 쿼리와 인덱스',
  transactions: '트랜잭션 · 락 · 데드락',
  'concert-seats': '콘서트 좌석 선점',
  'cart-stock': '장바구니와 재고 — 담아 둔 상품이 품절되는 순간',
  'payment-idempotency': '결제 — 이중 결제 막기',
  'waiting-room': '가상 대기실 · 처리량 제한',
  'hot-counters': '좋아요와 조회수 — 인기 글의 숫자가 바로 안 맞는 이유',
  'cache-stampede': '캐시 스탬피드',
  'feed-fanout': '피드 팬아웃',
  'realtime-delivery': '실시간 전달',
};

export interface Recommendation {
  readonly verdict: Verdict;
  readonly reasons: readonly Rule[];
  /** 걸린 규칙이 가리키는 모듈 id. 중복 없이 걸린 순서대로 담아요 */
  readonly modules: readonly string[];
}

export function decide(a: Answers): Recommendation {
  const reasons = RULES.filter((r) => r.when(a));
  const modules = [...new Set(reasons.flatMap((r) => r.modules))];
  return { verdict: pickVerdict(reasons), reasons, modules };
}

function pickVerdict(reasons: readonly Rule[]): Verdict {
  if (!reasons.some((r) => r.authority)) {
    return reasons.some((r) => r.pull === 'server') ? 'server' : 'client';
  }
  if (reasons.some((r) => r.hiddenFromClient)) return 'server';
  return reasons.some((r) => r.pull !== 'server') ? 'both' : 'server';
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly answers: Answers;
  readonly expected: Verdict;
}

const answers = (patch: Partial<Answers>): Answers => ({ ...DEFAULT_ANSWERS, ...patch });

export const PRESETS: readonly Preset[] = [
  {
    id: 'product-sort',
    label: '상품 목록 정렬',
    answers: answers({ dataSize: 'small', instant: true }),
    expected: 'client',
  },
  {
    id: 'cart-total',
    label: '장바구니 합계',
    answers: answers({ sensitive: true, dataSize: 'small', instant: true }),
    expected: 'both',
  },
  {
    id: 'coupon',
    label: '쿠폰 할인 적용',
    answers: answers({ sensitive: true, dataSize: 'small', instant: true, secret: true }),
    expected: 'server',
  },
  {
    id: 'autocomplete',
    label: '검색 자동완성',
    answers: answers({ dataSize: 'large', instant: true }),
    expected: 'server',
  },
  {
    id: 'like-count',
    label: '좋아요 수 표시',
    answers: answers({ shared: true, dataSize: 'small', instant: true }),
    expected: 'both',
  },
  {
    id: 'seat-left',
    label: '좌석 남은 수',
    answers: answers({ sensitive: true, shared: true, dataSize: 'medium' }),
    expected: 'server',
  },
  {
    id: 'excel-export',
    label: '엑셀 다운로드',
    answers: answers({ dataSize: 'large', heavy: true }),
    expected: 'server',
  },
  {
    id: 'chart-aggregate',
    label: '차트 집계',
    answers: answers({ dataSize: 'medium', heavy: true }),
    expected: 'server',
  },
];
