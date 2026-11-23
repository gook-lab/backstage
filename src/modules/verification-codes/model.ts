// 인증번호(OTP) 공격 모델. 모든 함수는 순수해요. 같은 입력이면 항상 같은 결과가 나와요.
// 단순화한 모델이에요. 번호는 균등하게 뽑히고 서로 독립이라고 가정해요.

/** 예시 공격자가 초당 보내는 시도 횟수 */
export const ATTACKER_RATE = 20;
/** 예시 공격 시간(초). 10분이에요 */
export const CAMPAIGN_SECONDS = 600;
/** 문자 폭탄 시나리오에서 공격자가 쓰는 번호 수 (예시) */
export const BOMB_NUMBERS = 10;

export type Scenario = 'brute' | 'resend' | 'bomb';

export interface OtpConfig {
  scenario: Scenario;
  digits: 6 | 8;
  /** 실패 시도 한도. null 이면 한도가 없어요 */
  attemptLimit: number | null;
  /** 재전송할 때 실패 횟수를 0으로 되돌리는지 */
  resetOnResend: boolean;
  /** 재전송할 때 이전 번호를 무효화하는지 */
  invalidateOnResend: boolean;
  /** 번호 만료 시간(초) */
  ttlSec: number;
  /** 재전송 간격(초). 0 이면 간격이 없어요 */
  cooldownSec: number;
  /** 번호 하나당 시간당 발송 한도. null 이면 한도가 없어요 */
  sendLimitPerNumber: number | null;
  /** IP 하나당 시간당 발송 한도. null 이면 한도가 없어요 */
  sendLimitPerIp: number | null;
}

export interface OtpResult {
  /** 가능한 번호 수 (10의 자릿수 제곱) */
  keyspace: number;
  /** 공격 동안 나가는 발송 건수. 문자 폭탄은 번호 전체의 합이에요 */
  smsSent: number;
  /** 같은 순간 유효한 번호 수 */
  activeCodes: number;
  /** 공격자가 추측할 수 있는 총 횟수 */
  guesses: number;
  /** 0 이상 1 이하 */
  successProbability: number;
}

export const keyspaceOf = (digits: number): number => 10 ** digits;

const cap = (value: number, limit: number | null): number => (limit === null ? value : Math.min(value, limit));

/** 재전송 간격이 0이면 공격자가 초당 한 번씩 보낸다고 봐요 */
const gapOf = (cooldownSec: number): number => Math.max(cooldownSec, 1);

/** 공격 시간 동안 번호 하나에 나가는 발송 건수. 첫 발송을 포함해요 */
export function sendsPerNumber(cfg: OtpConfig): number {
  return cap(1 + Math.floor(CAMPAIGN_SECONDS / gapOf(cfg.cooldownSec)), cfg.sendLimitPerNumber);
}

/**
 * 살아 있는 번호 active 개 중 하나를 guesses 번 추측해서 맞힐 확률.
 * 추측 한 번에 맞힐 확률은 active / keyspace 예요.
 */
export function hitProbability(active: number, keyspace: number, guesses: number): number {
  if (active <= 0 || guesses <= 0) return 0;
  return 1 - (1 - active / keyspace) ** guesses;
}

export function evaluate(cfg: OtpConfig): OtpResult {
  const keyspace = keyspaceOf(cfg.digits);
  const gap = gapOf(cfg.cooldownSec);

  if (cfg.scenario === 'brute') {
    // 번호 하나를 유효 시간 안에서 계속 추측해요
    const guesses = Math.min(keyspace, cap(ATTACKER_RATE * cfg.ttlSec, cfg.attemptLimit));
    return {
      keyspace,
      smsSent: 1,
      activeCodes: 1,
      guesses,
      successProbability: hitProbability(1, keyspace, guesses),
    };
  }

  if (cfg.scenario === 'resend') {
    // 재전송을 반복하면서 추측 기회를 늘려요
    const smsSent = cap(sendsPerNumber(cfg), cfg.sendLimitPerIp);
    const activeCodes = cfg.invalidateOnResend ? 1 : Math.min(smsSent, Math.ceil(cfg.ttlSec / gap));
    let guesses: number;
    if (cfg.resetOnResend) {
      // 번호마다 실패 횟수가 새로 생겨요. 번호가 살아 있는 시간만큼 추측할 수 있어요
      const window = cfg.invalidateOnResend ? Math.min(cfg.ttlSec, gap) : cfg.ttlSec;
      guesses = smsSent * cap(ATTACKER_RATE * window, cfg.attemptLimit);
    } else {
      // 실패 횟수가 계정에 남으면 전체 추측이 한도에서 멈춰요
      guesses = cap(ATTACKER_RATE * CAMPAIGN_SECONDS, cfg.attemptLimit);
    }
    return {
      keyspace,
      smsSent,
      activeCodes,
      guesses,
      successProbability: hitProbability(activeCodes, keyspace, guesses),
    };
  }

  // 문자 폭탄: 여러 번호에 발송 요청만 보내요. 추측은 하지 않아요
  const smsSent = cap(BOMB_NUMBERS * sendsPerNumber(cfg), cfg.sendLimitPerIp);
  return { keyspace, smsSent, activeCodes: 0, guesses: 0, successProbability: 0 };
}
