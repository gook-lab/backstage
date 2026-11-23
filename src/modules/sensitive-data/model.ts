/** 요청 안에서 민감한 값 하나. 모든 값은 가짜 예시예요 */
export type Item = 'token' | 'email' | 'card';

/** 값이 실리는 자리. 이메일과 카드 번호는 빠질 수도 있어요 */
export type Placement = 'query' | 'header' | 'body' | 'none';
export type Carrier = Exclude<Placement, 'none'>;

/** raw: 그대로 기록 · mask: 값만 가림 · allowlist: 허용한 필드만 기록 */
export type AppLog = 'raw' | 'mask' | 'allowlist';
/** raw: 페이지 주소와 폼 값을 그대로 보냄 · designed: 경로와 허용 속성만 보냄 */
export type Analytics = 'raw' | 'designed';
export type ReferrerPolicy = 'unsafe-url' | 'strict-origin-when-cross-origin' | 'no-referrer';
export type Retention = 'short' | 'long';
export type ResponseShape = 'full' | 'needed';

export interface Answers {
  readonly token: Carrier;
  readonly email: Placement;
  readonly card: Placement;
  readonly appLog: AppLog;
  /** 에러 추적으로 보내기 전에 요청 본문과 헤더를 지우는지 */
  readonly errorScrub: boolean;
  readonly analytics: Analytics;
  readonly referrer: ReferrerPolicy;
  readonly retention: Retention;
  readonly response: ResponseShape;
}

/** 재설정 링크를 쿼리로 넘긴 상태. 기본 설정 그대로예요 */
export const DEFAULT_ANSWERS: Answers = {
  token: 'query',
  email: 'body',
  card: 'body',
  appLog: 'raw',
  errorScrub: false,
  analytics: 'raw',
  referrer: 'strict-origin-when-cross-origin',
  retention: 'short',
  response: 'full',
};

export const SAMPLE: Record<Item, string> = {
  token: 'reset-EXAMPLE-token-0001',
  email: 'user@example.test',
  card: '1234-5678-9012-3456',
};

export const ITEM_LABEL: Record<Item, string> = {
  token: '토큰',
  email: '이메일',
  card: '카드 번호',
};

export type StoreId = 'access' | 'app' | 'error' | 'analytics' | 'history' | 'referer';

export interface Store {
  readonly id: StoreId;
  readonly label: string;
  /** 이 저장소에 실제로 남는 값 */
  readonly items: readonly Item[];
  /** 왜 남거나 남지 않는지 한 문장 */
  readonly reason: string;
  /** 보존 기간이 적용되는 저장소인지 */
  readonly kept: boolean;
}

const ITEMS: readonly Item[] = ['token', 'email', 'card'];

const where = (a: Answers, item: Item): Placement => (item === 'token' ? a.token : a[item]);

const placed = (a: Answers, at: Placement): Item[] => ITEMS.filter((item) => where(a, item) === at);

const queryItems = (a: Answers): Item[] => placed(a, 'query');

/** 값이 실제로 가는 저장소 목록을 만든다. 순서는 화면 표 순서와 같아요 */
export function exposure(a: Answers): Store[] {
  const bodyItems = placed(a, 'body');
  const headerItems = placed(a, 'header');

  const appItems: Item[] = a.appLog === 'raw' ? ITEMS.filter((item) => where(a, item) !== 'none') : [];
  const errorItems: Item[] = [...queryItems(a), ...(a.errorScrub ? [] : [...bodyItems, ...headerItems])];
  const analyticsItems: Item[] = a.analytics === 'raw' ? [...queryItems(a), ...bodyItems] : [];
  const referrerItems: Item[] = a.referrer === 'unsafe-url' ? queryItems(a) : [];

  return [
    {
      id: 'access',
      label: '서버 · 프록시 접근 로그',
      items: queryItems(a),
      reason: '요청 줄에 주소와 쿼리가 그대로 남아요. 본문과 헤더는 기본 설정에서 남지 않아요.',
      kept: true,
    },
    {
      id: 'app',
      label: '앱 로그',
      items: appItems,
      reason:
        a.appLog === 'raw'
          ? '요청 값을 통째로 기록해요. 쿼리, 본문, 헤더의 값이 모두 남아요.'
          : a.appLog === 'mask'
            ? '값을 *** 로 가려 기록해요. 키 이름으로 찾아 가리므로 이름이 목록에 없으면 새요.'
            : '허용한 필드만 기록해요. 민감한 값은 목록에 없어서 남지 않아요.',
      kept: true,
    },
    {
      id: 'error',
      label: '에러 추적 도구',
      items: errorItems,
      reason: a.errorScrub
        ? '요청 본문과 헤더는 지우고 보내요. 주소의 쿼리는 지우지 않아서 남아요.'
        : '요청 주소, 본문, 헤더를 그대로 보내요.',
      kept: true,
    },
    {
      id: 'analytics',
      label: '분석 이벤트',
      items: analyticsItems,
      reason:
        a.analytics === 'raw' ? '페이지 주소 전체와 폼 값을 속성으로 보내요.' : '경로만 보내고, 허용한 속성만 담아요.',
      kept: true,
    },
    {
      id: 'history',
      label: '브라우저 기록',
      items: queryItems(a),
      reason: '쿼리가 있는 주소로 이동하면 기록에 주소 전체가 남아요. 설정으로 막을 수 없어요.',
      kept: false,
    },
    {
      id: 'referer',
      label: 'Referer (교차 출처 요청)',
      items: referrerItems,
      reason:
        a.referrer === 'unsafe-url'
          ? '정책이 주소 전체를 보내도록 해서, 외부 자원 요청에 쿼리가 실려요.'
          : '출처나 빈 값만 보내서 쿼리는 실리지 않아요.',
      kept: false,
    },
  ];
}

/** 예시 보존 기간. 실제 기간은 서비스 정책으로 정해요 */
export const retentionDays = (a: Answers): number => (a.retention === 'short' ? 7 : 365);

/** 응답에 실리는 필드 예시. 전체 객체를 내리면 민감 필드까지 나가요 */
export function responseFields(a: Answers): readonly string[] {
  return a.response === 'needed' ? ['ok'] : ['id', 'email', 'name', 'passwordHash', 'lastLoginIp'];
}

export type Verdict = 'none' | 'leak';

export interface Summary {
  readonly tokenStores: number;
  readonly verdict: Verdict;
  readonly stores: readonly Store[];
}

export function summarize(a: Answers): Summary {
  const stores = exposure(a);
  const tokenStores = stores.filter((s) => s.items.includes('token')).length;
  return { tokenStores, verdict: stores.some((s) => s.items.length > 0) ? 'leak' : 'none', stores };
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly answers: Answers;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'query-default',
    label: '재설정 링크를 쿼리로, 기본 설정',
    answers: DEFAULT_ANSWERS,
  },
  {
    id: 'body-only',
    label: '토큰만 본문으로 옮기고 나머지는 그대로',
    answers: { ...DEFAULT_ANSWERS, token: 'body' },
  },
  {
    id: 'hardened',
    label: '본문 전송 · 마스킹 · 에러 정리 · 분석 설계 · Referrer-Policy',
    answers: {
      token: 'body',
      email: 'body',
      card: 'body',
      appLog: 'mask',
      errorScrub: true,
      analytics: 'designed',
      referrer: 'no-referrer',
      retention: 'short',
      response: 'needed',
    },
  },
];

export const VERDICT_LABEL: Record<Verdict, string> = {
  none: '민감한 값이 남는 저장소가 없어요',
  leak: '민감한 값이 저장소 여러 곳에 남아요',
};
