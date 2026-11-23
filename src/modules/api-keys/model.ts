/** 키 원문을 어떻게 저장하나요. plain: 원문 그대로, hash: 해시 값만 */
export type Storage = 'plain' | 'hash';

/** 클라이언트가 키를 실어 보내는 자리 */
export type Transport = 'header' | 'query';

/** 발급 뒤 화면에서 전체 키를 다시 볼 수 있나요 */
export type Display = 'once' | 'reveal';

/** 새 키를 낸 뒤 옛 키를 며칠 동안 계속 살려 두나요 */
export type Overlap = 'none' | 'three' | 'week' | 'long';

/** 사건. 공격자가 무엇을 손에 넣는지와 정상 요청이 어떻게 되는지가 달라요 */
export type Event = 'db-leak' | 'log-leak' | 'rotation-old' | 'revoked-use';

export interface Config {
  readonly storage: Storage;
  readonly transport: Transport;
  readonly display: Display;
  readonly overlap: Overlap;
}

export const STORAGE_LABEL: Readonly<Record<Storage, string>> = {
  plain: '평문 저장',
  hash: '해시 저장',
};

export const TRANSPORT_LABEL: Readonly<Record<Transport, string>> = {
  header: 'Authorization 헤더',
  query: 'URL 쿼리 (?api_key=)',
};

export const DISPLAY_LABEL: Readonly<Record<Display, string>> = {
  once: '발급 때 한 번만 보기',
  reveal: '목록에서 전체 키 다시 보기',
};

export const OVERLAP_DAYS: Readonly<Record<Overlap, number>> = {
  none: 0,
  three: 3,
  week: 7,
  long: 90,
};

export const OVERLAP_LABEL: Readonly<Record<Overlap, string>> = {
  none: '0일 — 새 키를 내자마자 옛 키 폐기',
  three: '3일 — 옮기는 기간만',
  week: '7일 — 대시보드 회전의 최대 겹침 기간과 같아요',
  long: '90일 — 옛 키를 오래 살려 둠',
};

export const EVENT_LABEL: Readonly<Record<Event, string>> = {
  'db-leak': 'DB 유출 — 저장된 값이 새어 나감',
  'log-leak': '로그 유출 — 요청 로그가 새어 나감',
  'rotation-old': '회전 중 옛 키 유출 — 옛 키가 아직 살아 있음',
  'revoked-use': '폐기된 옛 키 사용 — 겹침이 끝난 뒤 요청',
};

/** 시뮬레이션 가정. 실제 서비스 수치가 아니라 감을 잡기 위한 예시예요 */
export const MIGRATION_DAYS = 3;
export const DAILY_REQUESTS = 120;

export interface Outcome {
  /** 공격자가 지금 요청에 쓸 수 있는 키 값 수 */
  readonly attackerKeys: number;
  /** 계정 화면에서 다시 볼 수 있는 키 값 수 */
  readonly revealable: number;
  /** 옮기는 기간에 실패하는 정상 요청 수 */
  readonly failingLegit: number;
}

/** 해시로 저장하면 원문이 없어서 다시 보여 줄 수 없어요. 그때는 발급 때 한 번만 보여 줘요 */
export function effectiveDisplay(config: Config): Display {
  return config.storage === 'hash' ? 'once' : config.display;
}

/** 새 키 하나와, 겹침 기간 동안의 옛 키 하나 */
function liveKeys(overlapDays: number): number {
  return overlapDays > 0 ? 2 : 1;
}

export function simulate(config: Config, event: Event): Outcome {
  const days = OVERLAP_DAYS[config.overlap];
  const revealable = effectiveDisplay(config) === 'reveal' ? 1 : 0;
  const rotationFail = Math.max(0, MIGRATION_DAYS - days) * DAILY_REQUESTS;

  switch (event) {
    case 'db-leak':
      return {
        attackerKeys: config.storage === 'plain' ? liveKeys(days) : 0,
        revealable,
        failingLegit: 0,
      };
    case 'log-leak':
      return {
        attackerKeys: config.transport === 'query' ? liveKeys(days) : 0,
        revealable,
        failingLegit: 0,
      };
    case 'rotation-old':
      return {
        attackerKeys: days > 0 ? 1 : 0,
        revealable,
        failingLegit: rotationFail,
      };
    case 'revoked-use':
      return {
        attackerKeys: 0,
        revealable,
        failingLegit: rotationFail,
      };
  }
}

/** 판정 이유를 짧은 문장으로 돌려줘요. 화면과 테스트가 같은 문장을 씁니다 */
export function reasons(config: Config, event: Event): string[] {
  const lines: string[] = [];
  const days = OVERLAP_DAYS[config.overlap];

  if (event === 'db-leak') {
    lines.push(
      config.storage === 'plain'
        ? '평문 저장이라 DB에 있는 값이 그대로 키예요.'
        : '해시만 저장해서 DB에 키 원문이 없어요.',
    );
  }
  if (event === 'log-leak') {
    lines.push(
      config.transport === 'query'
        ? 'URL 쿼리에 실린 키는 접근 로그에 남아요.'
        : '헤더로 보낸 키는 기본 접근 로그에 남지 않는다고 가정해요.',
    );
  }
  if (event === 'rotation-old' || event === 'revoked-use') {
    lines.push(days > 0 ? `옛 키가 ${days}일 살아 있어요.` : '새 키를 내자마자 옛 키가 끊겨요.');
    if (days < MIGRATION_DAYS) {
      lines.push(`옮기는 ${MIGRATION_DAYS}일 중 ${MIGRATION_DAYS - days}일 동안 배치 요청이 실패해요.`);
    }
  }
  if (effectiveDisplay(config) === 'reveal') {
    lines.push('목록에서 전체 키를 다시 보여 주면 계정에 들어온 사람도 키를 가져갈 수 있어요.');
  }
  if (config.storage === 'hash' && config.display === 'reveal') {
    lines.push('해시로 저장해서 다시 보여 줄 수 없어요. 발급 때 한 번만 보여 줘요.');
  }
  return lines;
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly config: Config;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'mistake',
    label: '잘못된 예 — 평문 · URL 쿼리 · 다시 보기 · 옛 키 90일',
    config: { storage: 'plain', transport: 'query', display: 'reveal', overlap: 'long' },
  },
  {
    id: 'cut-off',
    label: '끊김 — 해시 · 헤더 · 한 번만 · 겹침 없음',
    config: { storage: 'hash', transport: 'header', display: 'once', overlap: 'none' },
  },
  {
    id: 'recommended',
    label: '권장 — 해시 · 헤더 · 한 번만 · 7일 겹침',
    config: { storage: 'hash', transport: 'header', display: 'once', overlap: 'week' },
  },
];

export const DEFAULT_CONFIG: Config = PRESETS[0].config;
