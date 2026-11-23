export type Platform = 'web' | 'ios' | 'android';
export type Outcome = 'ok' | 'warned' | 'gated' | 'blocked';
export type PolicyId = 'notice' | 'sunset' | 'force' | 'early';

export const OUTCOMES: readonly Outcome[] = ['ok', 'warned', 'gated', 'blocked'];

export interface PlatformSpec {
  id: Platform;
  label: string;
  /** 예시 사용자 비율 */
  share: number;
  /** 예시: 업데이트 없이 옛 버전에 머무는 비율. 열어 둔 탭, 앱을 열지 않는 기기 */
  stuck: number;
  /** 예시: 새 버전이 나온 뒤 업데이트가 끝나는 데 걸리는 날 */
  adoptDays: number;
  /** 최소 지원 버전 업데이트 화면을 만날 수 있는지. 웹은 새로고침으로 바뀐다고 본다 */
  gate: boolean;
}

export const PLATFORMS: readonly PlatformSpec[] = [
  { id: 'web', label: '웹', share: 0.4, stuck: 0.03, adoptDays: 1, gate: false },
  { id: 'ios', label: 'iOS 앱', share: 0.3, stuck: 0.05, adoptDays: 30, gate: true },
  { id: 'android', label: 'Android 앱', share: 0.3, stuck: 0.1, adoptDays: 45, gate: true },
];

export interface Policy {
  id: PolicyId;
  label: string;
  summary: string;
  /** Deprecation 헤더를 붙이기 시작하는 날 */
  deprecateDay: number;
  /** Sunset 날짜. null 이면 옛 버전을 끝까지 응답해요 */
  sunsetDay: number | null;
  /** 최소 지원 버전 발효일. 앱에만 적용해요. null 이면 발효하지 않아요 */
  forceDay: number | null;
}

export const POLICIES: readonly Policy[] = [
  {
    id: 'notice',
    label: '알림만',
    summary: 'Deprecation 헤더만 붙여요. Sunset 날짜가 없어서 옛 버전은 끝까지 그대로 응답해요.',
    deprecateDay: 30,
    sunsetDay: null,
    forceDay: null,
  },
  {
    id: 'sunset',
    label: '폐기 날짜에 차단',
    summary: 'Sunset 날짜를 미리 알리고, 그 날부터 옛 버전 요청에 410을 돌려줘요.',
    deprecateDay: 30,
    sunsetDay: 90,
    forceDay: null,
  },
  {
    id: 'force',
    label: '최소 버전 강제 업데이트',
    summary:
      '20일째부터 앱 실행 때 업데이트 화면을 띄워요. 앱을 열지 않는 기기는 이 화면을 만나지 못해서 90일째 차단돼요.',
    deprecateDay: 10,
    sunsetDay: 90,
    forceDay: 20,
  },
  {
    id: 'early',
    label: '폐기 날짜를 짧게',
    summary: '공지 뒤 10일 만에 차단해요. 옛 앱이 업데이트할 시간이 짧아요.',
    deprecateDay: 30,
    sunsetDay: 40,
    forceDay: null,
  },
];

export const policyById = (id: PolicyId): Policy => POLICIES.find((p) => p.id === id) ?? POLICIES[0];

/** 강제 발효 뒤 앱이 업데이트를 끝내는 데 걸리는 날 (예시) */
export const FORCE_DAYS = 7;
export const MAX_DAY = 180;

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** 업데이트 가능한 옛 버전 비율(stuck 제외). 강제 발효 뒤에는 FORCE_DAYS 동안 줄어요 */
function movableLeft(p: PlatformSpec, day: number, policy: Policy): number {
  const { forceDay } = policy;
  if (!p.gate || forceDay === null || day < forceDay) {
    return Math.max(0, 1 - day / p.adoptDays) * (1 - p.stuck);
  }
  const atForce = Math.max(0, 1 - forceDay / p.adoptDays) * (1 - p.stuck);
  return atForce * Math.max(0, 1 - (day - forceDay) / FORCE_DAYS);
}

/** 옛 버전을 쓰는 비율 = 업데이트 안 한 기기 + 업데이트 중인 기기 */
export function oldShareOf(p: PlatformSpec, day: number, policy: Policy): number {
  return p.stuck + movableLeft(p, day, policy);
}

/** 플랫폼 안에서 응답 결과별 비율. 합은 1 */
export function platformOutcomes(p: PlatformSpec, day: number, policy: Policy): Record<Outcome, number> {
  const out: Record<Outcome, number> = { ok: 0, warned: 0, gated: 0, blocked: 0 };
  const movable = movableLeft(p, day, policy);
  out.ok += 1 - p.stuck - movable;

  const sunset = policy.sunsetDay !== null && day >= policy.sunsetDay;
  const warn = day >= policy.deprecateDay;
  const forced = p.gate && policy.forceDay !== null && day >= policy.forceDay;

  const movableOutcome: Outcome = forced ? 'gated' : sunset ? 'blocked' : warn ? 'warned' : 'ok';
  const stuckOutcome: Outcome = sunset ? 'blocked' : warn ? 'warned' : 'ok';
  out[movableOutcome] += movable;
  out[stuckOutcome] += p.stuck;
  return out;
}

export interface Row {
  platform: PlatformSpec;
  outcomes: Record<Outcome, number>;
}

export interface Event {
  day: number;
  text: string;
}

export interface Snapshot {
  rows: Row[];
  /** 전체 사용자 기준 결과 비율 */
  total: Record<Outcome, number>;
  /** 전체 사용자 중 옛 버전을 쓰는 비율 */
  oldShare: number;
  events: Event[];
}

export function policyEvents(policy: Policy): Event[] {
  const events: Event[] = [{ day: 0, text: '새 버전을 출시해요. 새 응답 모양을 내보내기 시작해요.' }];
  events.push({
    day: policy.deprecateDay,
    text:
      policy.sunsetDay === null
        ? 'Deprecation 헤더를 붙여요. 차단 날짜는 없어요.'
        : 'Deprecation 헤더와 Sunset 날짜를 붙여요.',
  });
  if (policy.forceDay !== null) {
    events.push({ day: policy.forceDay, text: '최소 지원 버전을 올려요. 앱은 업데이트 화면을 거쳐야 해요.' });
  }
  if (policy.sunsetDay !== null) {
    events.push({ day: policy.sunsetDay, text: 'Sunset 날짜예요. 옛 버전 요청은 410으로 막혀요.' });
  }
  return events.sort((a, b) => a.day - b.day);
}

export function snapshot(day: number, policy: Policy): Snapshot {
  const weight = PLATFORMS.reduce((sum, p) => sum + p.share, 0);
  const total: Record<Outcome, number> = { ok: 0, warned: 0, gated: 0, blocked: 0 };
  let oldShare = 0;
  const rows = PLATFORMS.map((platform) => {
    const outcomes = platformOutcomes(platform, day, policy);
    for (const k of OUTCOMES) total[k] += (platform.share * outcomes[k]) / weight;
    oldShare += (platform.share * oldShareOf(platform, day, policy)) / weight;
    return { platform, outcomes };
  });
  return { rows, total, oldShare, events: policyEvents(policy) };
}

export function describeDay(policy: Policy, day: number, total: Record<Outcome, number>): string {
  const head = `${day}일째예요.`;
  if (day < policy.deprecateDay) return `${head} 아직 알림이 없어요. 옛 버전도 정상으로 응답해요.`;
  const parts = [`${head} 옛 버전 응답에 알림이 붙어 있어요.`];
  if (policy.forceDay !== null && day >= policy.forceDay) {
    parts.push(`업데이트하지 않은 앱은 업데이트 화면에서 멈춰요 (${pct(total.gated)}).`);
  }
  if (policy.sunsetDay !== null && day >= policy.sunsetDay) {
    parts.push(`Sunset 날짜가 지나 전체 사용자 ${pct(total.blocked)}가 410 응답을 받아요.`);
  } else if (policy.sunsetDay !== null) {
    parts.push(`차단은 ${policy.sunsetDay}일째부터예요.`);
  }
  return parts.join(' ');
}
