/** 빌드 도구 — 접두 규칙이 다르다 */
export type Tool = 'vite' | 'next';

/**
 * build: 빌드할 때 읽히는 환경 (.env 파일 · CI 변수). 여기 있는 값만 번들 후보가 돼요.
 * server: 서버가 실행될 때만 주입되는 환경 변수. 빌드에는 없어요.
 * vault: 비밀 관리 서비스. 서버가 실행 중에 가져가요.
 */
export type Placement = 'build' | 'server' | 'vault';

/** public: 공개해도 되는 값. secret: 노출되면 안 되는 값 */
export type Kind = 'public' | 'secret';

export interface ConfigItem {
  readonly id: string;
  /** 접두를 뺀 이름 */
  readonly base: string;
  readonly label: string;
  readonly kind: Kind;
  /** 브라우저 코드가 이 값을 읽어야 하나요 */
  readonly needsBrowser: boolean;
  /** 화면과 번들 미리보기에만 쓰는 가짜 값 */
  readonly sample: string;
}

export interface Choice {
  readonly placement: Placement;
  /** 이름 앞에 빌드 도구의 접두를 붙였나요 */
  readonly prefixed: boolean;
}

export type Choices = Readonly<Record<string, Choice>>;

export const TOOLS: readonly { value: Tool; label: string }[] = [
  { value: 'vite', label: 'Vite (VITE_)' },
  { value: 'next', label: 'Next.js (NEXT_PUBLIC_)' },
];

export const PREFIX: Readonly<Record<Tool, string>> = {
  vite: 'VITE_',
  next: 'NEXT_PUBLIC_',
};

export const PLACEMENT_LABEL: Readonly<Record<Placement, string>> = {
  build: '빌드 환경',
  server: '서버 실행 환경',
  vault: '비밀 관리 서비스',
};

export const ITEMS: readonly ConfigItem[] = [
  {
    id: 'map',
    base: 'MAP_KEY',
    label: '공개 키',
    kind: 'public',
    needsBrowser: true,
    sample: 'pk_example_0001',
  },
  {
    id: 'api',
    base: 'API_BASE_URL',
    label: 'API 주소',
    kind: 'public',
    needsBrowser: true,
    sample: 'https://api.example.test',
  },
  {
    id: 'payment',
    base: 'PAYMENT_SECRET_KEY',
    label: '결제 서버 비밀 키',
    kind: 'secret',
    needsBrowser: false,
    sample: 'EXAMPLE_PAYMENT_0002',
  },
  {
    id: 'db',
    base: 'DB_PASSWORD',
    label: 'DB 비밀번호',
    kind: 'secret',
    needsBrowser: false,
    sample: 'example-db-pass-0003',
  },
  {
    id: 'jwt',
    base: 'JWT_SIGNING_KEY',
    label: '토큰 서명 키',
    kind: 'secret',
    needsBrowser: false,
    sample: 'example-signing-0004',
  },
];

/** 화면 첫 상태: 흔히 하는 실수 한 가지 */
export const DEFAULT_TOOL: Tool = 'vite';

export const DEFAULT_CHOICES: Choices = Object.fromEntries(
  ITEMS.map((item) => [item.id, { placement: 'build', prefixed: true }]),
);

export const nameOf = (tool: Tool, item: ConfigItem, choice: Choice): string =>
  choice.prefixed ? PREFIX[tool] + item.base : item.base;

/** 빌드 환경에 있고 접두가 붙은 값만 배포 번들에 들어가요 */
export const inBundle = (choice: Choice): boolean => choice.placement === 'build' && choice.prefixed;

export type Verdict = 'leak' | 'trap' | 'missing' | 'public' | 'safe';

export const VERDICT_LABEL: Readonly<Record<Verdict, string>> = {
  leak: '배포 번들에 비밀 값이 들어가요',
  trap: '접두 때문에 공개 값처럼 보여요',
  missing: '브라우저 코드에서 읽을 수 없어요',
  public: '공개 값이라 번들에 있어도 돼요',
  safe: '서버에만 있어요',
};

export const VERDICT_HINT: Readonly<Record<Verdict, string>> = {
  leak: '누구나 배포된 JS 파일에서 읽을 수 있어요. 값을 폐기하고 교체해야 해요.',
  trap: '지금은 번들에 없지만, 같은 이름을 빌드 환경으로 옮기는 순간 노출돼요.',
  missing: '번들에 값이 없어서 브라우저 코드에서는 undefined가 돼요. 접두를 붙이거나 값을 옮겨야 해요.',
  public: '브라우저에 가도 되는 값이에요. 대신 사용처를 제한하고 사용량을 감시해요.',
  safe: '배포 번들에 없어요. 서버 코드에서만 읽어요.',
};

/** 판정 순서가 곧 우선순위다. 비밀이 번들에 들어가면 다른 문제보다 먼저 보여 준다 */
export function judge(item: ConfigItem, choice: Choice): Verdict {
  if (inBundle(choice)) return item.kind === 'secret' ? 'leak' : 'public';
  if (item.needsBrowser) return 'missing';
  if (item.kind === 'secret' && choice.prefixed) return 'trap';
  return 'safe';
}

export interface Row {
  readonly item: ConfigItem;
  readonly name: string;
  readonly bundled: boolean;
  readonly verdict: Verdict;
}

export interface Review {
  readonly rows: readonly Row[];
  readonly leaks: number;
  /** 번들에 들어가는 줄. 예시 값을 이름 옆에 붙여 보여 줘요 */
  readonly bundleLines: readonly string[];
}

export function review(tool: Tool, choices: Choices): Review {
  const rows: Row[] = ITEMS.map((item) => {
    const choice = choices[item.id];
    return {
      item,
      name: nameOf(tool, item, choice),
      bundled: inBundle(choice),
      verdict: judge(item, choice),
    };
  });
  return {
    rows,
    leaks: rows.filter((r) => r.verdict === 'leak').length,
    bundleLines: rows.filter((r) => r.bundled).map((r) => `${r.name} = "${r.item.sample}"`),
  };
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly tool: Tool;
  readonly choices: Choices;
}

const choice = (placement: Placement, prefixed: boolean): Choice => ({ placement, prefixed });

export const PRESETS: readonly Preset[] = [
  {
    id: 'mistake',
    label: '잘못 만든 예 — 비밀까지 접두를 붙여 빌드 환경에 둠',
    tool: 'vite',
    choices: {
      map: choice('build', true),
      api: choice('build', true),
      payment: choice('build', true),
      db: choice('build', true),
      jwt: choice('build', true),
    },
  },
  {
    id: 'recommended',
    label: '권장 — 공개 값만 빌드에, 비밀은 서버 뒤에',
    tool: 'vite',
    choices: {
      map: choice('build', true),
      api: choice('build', true),
      payment: choice('vault', false),
      db: choice('vault', false),
      jwt: choice('vault', false),
    },
  },
  {
    id: 'no-prefix',
    label: '접두를 빼먹은 공개 키',
    tool: 'vite',
    choices: {
      map: choice('build', false),
      api: choice('build', true),
      payment: choice('vault', false),
      db: choice('vault', false),
      jwt: choice('vault', false),
    },
  },
  {
    id: 'name-trap',
    label: '이름만 보고 접두를 붙인 서버 키',
    tool: 'next',
    choices: {
      map: choice('build', true),
      api: choice('build', true),
      payment: choice('server', true),
      db: choice('vault', false),
      jwt: choice('vault', false),
    },
  },
];

/** 노출이 확인되면 이 순서로 한다. 폐기 · 교체가 먼저이고, 이력 정리는 맨 마지막이에요 */
export const LEAK_STEPS: readonly string[] = [
  '노출된 값을 먼저 폐기하거나 교체해요. 새 값은 비밀 관리 서비스나 서버 환경에 넣어요.',
  '값이 들어 있던 빌드를 버리고, 새 빌드를 배포해요. 이전 번들은 이전 값을 그대로 담고 있어요.',
  '빌드 환경(.env 파일 · CI 변수)에서 비밀 값을 지워요.',
  '폐기 전후의 사용 기록을 확인해요. 누가 언제 값을 썼는지 봐요.',
  '저장소 커밋 이력에 값이 남았다면, 교체가 끝난 뒤에 이력 정리를 검토해요.',
];
