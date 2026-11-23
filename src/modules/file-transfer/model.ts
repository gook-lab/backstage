/**
 * 단일 업로드와 멀티파트 업로드를 같은 끊김 패턴에서 비교하는 순수 모델.
 * 단위는 MiB. 끊김은 시드 난수로 정해서 같은 입력이면 같은 결과가 나와요.
 */

export const MIN_PART_MIB = 5;
export const MAX_PARTS = 10000;
/** 한 조각(또는 단일 업로드)을 이만큼 시도하면 그 업로드는 끝내 실패로 봐요 */
export const MAX_ATTEMPTS = 10;

export interface Scenario {
  readonly fileMiB: number;
  /** 사용자가 고른 조각 크기. 실제 적용 값은 effectivePartMiB 가 정해요 */
  readonly partMiB: number;
  /** 100 MiB 를 보내는 동안 연결이 끊길 확률 (0 ~ 1). 끊김은 보낸 양에 비례해 생겨요 */
  readonly dropPer100MiB: number;
  readonly seed: number;
}

export interface Transfer {
  readonly completed: boolean;
  /** 네트워크에 실제로 나간 총량. 끊긴 시도의 양도 포함해요 */
  readonly sentMiB: number;
  /** 끊겨서 버린 양. 같은 바이트를 다시 보내야 했던 만큼이에요 */
  readonly wastedMiB: number;
  readonly attempts: number;
  readonly parts: number;
}

export interface Comparison {
  readonly single: Transfer;
  readonly multipart: Transfer;
}

/** 조각 수가 10,000 개를 넘지 않도록 조각 크기의 하한을 정해요 */
export function minPartMiB(fileMiB: number): number {
  return Math.max(MIN_PART_MIB, Math.ceil(fileMiB / MAX_PARTS));
}

export function effectivePartMiB(fileMiB: number, partMiB: number): number {
  return Math.max(partMiB, minPartMiB(fileMiB));
}

/** 결정적 난수. 같은 시드면 같은 수열을 돌려줘요 */
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

/** 끊김은 MiB 당 일정한 확률로 생긴다고 봐요. 100 MiB 동안 끊길 확률이 p 이면 MiB 당 확률은 1 - (1 - p)^(1/100) */
export function dropPerMiB(dropPer100MiB: number): number {
  return 1 - (1 - dropPer100MiB) ** (1 / 100);
}

interface UnitResult {
  readonly completed: boolean;
  readonly sentMiB: number;
  readonly wastedMiB: number;
  readonly attempts: number;
}

/** 한 덩어리(단일 업로드 전체 또는 조각 하나)를 끝까지 보내거나, 시도 한도를 넘길 때까지 다시 보내요 */
function sendUnit(sizeMiB: number, hazard: number, rand: () => number): UnitResult {
  let sent = 0;
  let wasted = 0;
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    // 끊김이 생기는 지점(MiB). 난수가 1 에 가까울수록 늦게 끊겨요
    const dropAt = hazard === 0 ? Infinity : Math.log(1 - rand()) / Math.log(1 - hazard);
    if (dropAt >= sizeMiB) {
      return { completed: true, sentMiB: sent + sizeMiB, wastedMiB: wasted, attempts };
    }
    sent += dropAt;
    wasted += dropAt;
  }
  return { completed: false, sentMiB: sent, wastedMiB: wasted, attempts };
}

function singleUpload(fileMiB: number, hazard: number, seed: number): Transfer {
  const unit = sendUnit(fileMiB, hazard, mulberry32(seed));
  return { ...unit, parts: 1 };
}

function multipartUpload(fileMiB: number, partMiB: number, hazard: number, seed: number): Transfer {
  const rand = mulberry32(seed);
  const parts = Math.ceil(fileMiB / partMiB);
  let sent = 0;
  let wasted = 0;
  let attempts = 0;
  for (let i = 0; i < parts; i += 1) {
    const size = Math.min(partMiB, fileMiB - i * partMiB);
    const unit = sendUnit(size, hazard, rand);
    sent += unit.sentMiB;
    wasted += unit.wastedMiB;
    attempts += unit.attempts;
    if (!unit.completed) return { completed: false, sentMiB: sent, wastedMiB: wasted, attempts, parts };
  }
  return { completed: true, sentMiB: sent, wastedMiB: wasted, attempts, parts };
}

export function simulate(s: Scenario): Comparison {
  const hazard = dropPerMiB(s.dropPer100MiB);
  const partMiB = effectivePartMiB(s.fileMiB, s.partMiB);
  return {
    single: singleUpload(s.fileMiB, hazard, s.seed),
    multipart: multipartUpload(s.fileMiB, partMiB, hazard, s.seed),
  };
}

export const FILE_SIZES: readonly { value: string; label: string; mib: number }[] = [
  { value: '100', label: '100 MiB · 사진 여러 장', mib: 100 },
  { value: '1024', label: '1 GiB · 영상 한 편', mib: 1024 },
  { value: '10240', label: '10 GiB · 큰 원본 영상', mib: 10240 },
];

export const PART_SIZES: readonly { value: string; label: string; mib: number }[] = [
  { value: '5', label: '5 MiB', mib: 5 },
  { value: '16', label: '16 MiB', mib: 16 },
  { value: '64', label: '64 MiB', mib: 64 },
  { value: '256', label: '256 MiB', mib: 256 },
];

export function formatMiB(mib: number): string {
  if (mib >= 1024) return `${(mib / 1024).toFixed(2)} GiB`;
  return `${Math.round(mib)} MiB`;
}
