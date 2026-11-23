/**
 * 로그인 공격 시뮬레이터의 순수 모델. 같은 시드면 항상 같은 결과가 나와요.
 * 모든 수치는 설명을 위한 예시예요. 실제 서비스의 임계값이 아니에요.
 */

export type Attack = 'brute' | 'stuffing' | 'spread';
export type Defense = 'ip' | 'account' | 'global' | 'lockout' | 'mfa';
/** wait: 막히면 공격자가 다음 틱에 같은 시도를 다시 보내요. consume: 그 시도는 버려져요 */
export type Gate = 'lock' | 'ip' | 'account' | 'captcha' | 'mfa';

export const ATTACKS: readonly Attack[] = ['brute', 'stuffing', 'spread'];
export const DEFENSES: readonly Defense[] = ['ip', 'account', 'global', 'lockout', 'mfa'];
export const GATES: readonly Gate[] = ['lock', 'ip', 'account', 'captcha', 'mfa'];

export const ATTACK_LABEL: Record<Attack, string> = {
  brute: '한 계정 무차별 대입',
  stuffing: '유출 쌍 스터핑 (IP 1개)',
  spread: '유출 쌍 스터핑 (IP 1000개로 분산)',
};

export const DEFENSE_LABEL: Record<Defense, string> = {
  ip: 'IP 기준 제한',
  account: '계정 기준 제한 (지연)',
  global: '전체 실패율 기준 캡차',
  lockout: '계정 잠금',
  mfa: 'MFA (추가 인증)',
};

export const GATE_LABEL: Record<Gate, string> = {
  lock: '계정 잠금',
  ip: 'IP 기준 제한',
  account: '계정 기준 지연',
  captcha: '캡차',
  mfa: 'MFA',
};

export interface Params {
  attack: Attack;
  defenses: readonly Defense[];
  /** 틱당 공격 요청 수 */
  attackRate: number;
  seed: number;
}

export interface Result {
  /** 비밀번호 검사까지 간 공격 시도 */
  attempts: number;
  /** 공격이 로그인에 성공한 계정 수 */
  compromised: number;
  /** 한 번이라도 잠긴 계정 수 */
  lockedAccounts: number;
  /** 정상 로그인 요청 수 */
  legitTotal: number;
  /** 막힌 정상 로그인 요청 수 */
  legitBlocked: number;
  legitBlockedBy: Record<Gate, number>;
  /** 막힌 공격 요청 수 (재시도 포함) */
  attackBlocked: number;
  attackBlockedBy: Record<Gate, number>;
  /** 시간이 끝났을 때 공격 대기열에 남은 시도 */
  attackLeft: number;
}

export const HORIZON = 180;
/** 계정 0 은 피해자 계정이고, 1 부터 299 까지는 정상 사용자 계정이에요 */
export const USERS = 300;
export const VICTIM = 0;
/** 무차별 대입에서 공격자가 가진 사전 크기. 정답은 이 중 한 번째에 있어요 */
export const GUESSES = 3000;
/** 유출 쌍 개수. 쌍 하나는 계정 하나를 겨냥해요 */
export const PAIRS = 250;
/** 유출 쌍 중 지금도 맞는 비율 */
export const REUSE = 0.03;
/** 정상 사용자가 비밀번호를 잘못 입력하는 비율 */
export const TYPO = 0.05;
/** 틱당 정상 로그인 요청 수 */
export const LEGIT_RATE = 3;
/** 정상 로그인 중 피해자 계정이 차지하는 비율 (예시) */
export const VICTIM_SHARE = 0.2;
/** 정상 사용자가 나눠 쓰는 사무실 공유 IP 수 */
export const NAT_IPS = 2;
const ATTACK_IP_BASE = 100;
/** 분산 공격에서 쓰는 IP 수 */
export const SPREAD_IPS = 1000;

export const IP_WINDOW = 10;
export const IP_LIMIT = 20;
export const ACCOUNT_WINDOW = 10;
export const ACCOUNT_FAILS = 3;
export const CAPTCHA_WINDOW = 10;
export const CAPTCHA_FAIL_RATE = 0.3;
export const CAPTCHA_MIN_SAMPLE = 10;
export const BOT_SOLVE = 0.9;
export const HUMAN_PASS = 0.95;
export const LOCK_WINDOW = 30;
export const LOCK_FAILS = 5;
export const LOCK_TICKS = 30;
export const MFA_HUMAN_PASS = 0.98;

/** 작고 빠른 결정론적 난수 (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emptyGates = (): Record<Gate, number> => ({ lock: 0, ip: 0, account: 0, captcha: 0, mfa: 0 });

interface Req {
  account: number;
  ip: number;
  /** 비밀번호가 맞는지. 공격에서는 유출 쌍이나 사전의 정답 여부 */
  correct: boolean;
  attack: boolean;
}

type Outcome = { kind: 'wait'; gate: Gate } | { kind: 'consume'; gate: Gate } | { kind: 'done'; ok: boolean };

export function simulate(p: Params): Result {
  const has = (d: Defense) => p.defenses.includes(d);
  const gen = mulberry32(p.seed);
  // 게이트에서만 쓰는 난수. 생성 난수와 분리해서, 방어를 켜도 정상 요청의 모양은 같아요
  const gate = mulberry32((p.seed * 7919 + 13) >>> 0);

  const queue: Req[] = [];
  if (p.attack === 'brute') {
    const secret = Math.floor(gen() * GUESSES);
    for (let i = 0; i < GUESSES; i++) {
      queue.push({ account: VICTIM, ip: ATTACK_IP_BASE, correct: i === secret, attack: true });
    }
  } else {
    const ips = p.attack === 'spread' ? SPREAD_IPS : 1;
    for (let i = 0; i < PAIRS; i++) {
      queue.push({ account: i + 1, ip: ATTACK_IP_BASE + (i % ips), correct: gen() < REUSE, attack: true });
    }
  }

  const ipCount = new Map<string, number>();
  const acctFails = new Map<string, number>();
  const lockFailTicks = new Map<number, number[]>();
  const lockUntil = new Map<number, number>();
  const everLocked = new Set<number>();
  const compromised = new Set<number>();
  // 틱별 처리 수와 실패 수. 전체 실패율 캡차의 기준이에요
  const hist: { n: number; f: number }[] = Array.from({ length: HORIZON }, () => ({ n: 0, f: 0 }));

  const captchaActive = (t: number): boolean => {
    let n = 0;
    let f = 0;
    for (let k = Math.max(0, t - CAPTCHA_WINDOW); k <= t; k++) {
      n += hist[k].n;
      f += hist[k].f;
    }
    return n >= CAPTCHA_MIN_SAMPLE && f / n >= CAPTCHA_FAIL_RATE;
  };

  const r: Result = {
    attempts: 0,
    compromised: 0,
    lockedAccounts: 0,
    legitTotal: 0,
    legitBlocked: 0,
    legitBlockedBy: emptyGates(),
    attackBlocked: 0,
    attackBlockedBy: emptyGates(),
    attackLeft: 0,
  };

  const attempt = (req: Req, t: number): Outcome => {
    const lockedTo = lockUntil.get(req.account);
    if (has('lockout') && lockedTo !== undefined && t < lockedTo) return { kind: 'wait', gate: 'lock' };

    if (has('ip')) {
      const key = `${req.ip}|${Math.floor(t / IP_WINDOW)}`;
      const c = ipCount.get(key) ?? 0;
      if (c >= IP_LIMIT) return { kind: 'wait', gate: 'ip' };
      ipCount.set(key, c + 1);
    }

    if (has('account')) {
      const key = `${req.account}|${Math.floor(t / ACCOUNT_WINDOW)}`;
      if ((acctFails.get(key) ?? 0) >= ACCOUNT_FAILS) return { kind: 'wait', gate: 'account' };
    }

    if (has('global') && captchaActive(t)) {
      const pass = gate() < (req.attack ? BOT_SOLVE : HUMAN_PASS);
      if (!pass) return { kind: 'consume', gate: 'captcha' };
    }

    r.attempts += req.attack ? 1 : 0;
    if (!req.correct) {
      hist[t].n += 1;
      hist[t].f += 1;
      const key = `${req.account}|${Math.floor(t / ACCOUNT_WINDOW)}`;
      acctFails.set(key, (acctFails.get(key) ?? 0) + 1);
      if (has('lockout')) {
        const ticks = (lockFailTicks.get(req.account) ?? []).filter((x) => x > t - LOCK_WINDOW);
        ticks.push(t);
        if (ticks.length >= LOCK_FAILS) {
          lockUntil.set(req.account, t + LOCK_TICKS);
          everLocked.add(req.account);
          lockFailTicks.set(req.account, []);
        } else {
          lockFailTicks.set(req.account, ticks);
        }
      }
      return { kind: 'done', ok: false };
    }

    hist[t].n += 1;
    if (has('mfa')) {
      // 공격자는 두 번째 요소가 없다고 가정해요. 정상 사용자는 일부가 이탈해요
      if (req.attack) return { kind: 'consume', gate: 'mfa' };
      if (gate() >= MFA_HUMAN_PASS) return { kind: 'consume', gate: 'mfa' };
    }
    return { kind: 'done', ok: true };
  };

  for (let t = 0; t < HORIZON; t++) {
    // 정상 요청은 틱마다 같은 난수 순서로 뽑아요
    const legit: Req[] = [];
    for (let k = 0; k < LEGIT_RATE; k++) {
      const victim = gen() < VICTIM_SHARE;
      const account = victim ? VICTIM : 1 + Math.floor(gen() * (USERS - 1));
      const ip = 1 + Math.floor(gen() * NAT_IPS);
      const typo = gen() < TYPO;
      legit.push({ account, ip, correct: !typo, attack: false });
    }

    // 공격자: 허용된 시도만 대기열에서 빠져요. 막히면 같은 시도를 다음 틱에 다시 보내요
    let slots = p.attackRate;
    while (slots > 0 && queue.length > 0) {
      const req = queue[0];
      const out = attempt(req, t);
      if (out.kind === 'wait') {
        r.attackBlocked += 1;
        r.attackBlockedBy[out.gate] += 1;
        break;
      }
      queue.shift();
      slots -= 1;
      if (out.kind === 'consume') {
        r.attackBlocked += 1;
        r.attackBlockedBy[out.gate] += 1;
        continue;
      }
      if (out.ok) {
        compromised.add(req.account);
        if (p.attack === 'brute') queue.length = 0;
      }
    }

    for (const req of legit) {
      r.legitTotal += 1;
      const out = attempt(req, t);
      if (out.kind === 'done') continue;
      r.legitBlocked += 1;
      r.legitBlockedBy[out.gate] += 1;
    }
  }

  r.compromised = compromised.size;
  r.lockedAccounts = everLocked.size;
  r.attackLeft = queue.length;
  return r;
}
