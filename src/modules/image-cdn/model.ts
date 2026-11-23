export type Format = 'avif' | 'webp' | 'jpeg';
export type Slot = 'full' | 'half' | 'fixed';
export type KeyPolicy = 'path' | 'width' | 'width-format' | 'query-accept';

export interface Device {
  readonly id: string;
  readonly label: string;
  /** CSS 픽셀 너비 (viewport) */
  readonly cssWidth: number;
  readonly dpr: number;
  /** 이 기기의 브라우저가 Accept 로 알려 주는 형식 */
  readonly formats: readonly Format[];
}

export interface Choice {
  readonly width: number;
  readonly format: Format;
  readonly bytes: number;
}

export interface Req {
  readonly image: number;
  readonly width: number;
  readonly format: Format;
  /** Accept 헤더 원문 예시. 같은 형식이라도 브라우저마다 문자열이 달라질 수 있어요 */
  readonly accept: string;
}

export interface PolicyResult {
  readonly policy: KeyPolicy;
  readonly requests: number;
  readonly hits: number;
  readonly originRequests: number;
  /** 캐시가 요청과 다른 크기 · 형식의 파일을 돌려 준 횟수 */
  readonly wrong: number;
  readonly hitRatio: number;
}

/** 원본은 가로 2400px JPEG 이고, 모든 변형의 가로 픽셀 목록 중 가장 큰 후보예요 */
export const ORIGINAL_WIDTH = 2400;
export const ALL_WIDTHS: readonly number[] = [320, 640, 960, 1280, 1920];
export const ALL_FORMATS: readonly Format[] = ['avif', 'webp', 'jpeg'];
export const IMAGE_COUNT = 12;
export const REQUEST_COUNT = 2000;
/** 고정 슬롯 너비 (CSS px) */
const FIXED_SLOT = 320;
const ASPECT = 2 / 3;

/**
 * 예시 계수. 실제 인코더 결과가 아니에요.
 * 형식끼리 크기 차이가 어떤 방향으로 나는지 보여 주려고 잡은 값이에요.
 */
const BYTES_PER_PIXEL: Record<Format, number> = { jpeg: 0.9, webp: 0.6, avif: 0.45 };

export function variantBytes(width: number, format: Format): number {
  const height = Math.round(width * ASPECT);
  return Math.round(width * height * BYTES_PER_PIXEL[format]);
}

export const ORIGINAL_BYTES = variantBytes(ORIGINAL_WIDTH, 'jpeg');

export const DEVICES: readonly Device[] = [
  {
    id: 'phone-modern',
    label: '휴대폰 · 375px · DPR 3 · AVIF 지원',
    cssWidth: 375,
    dpr: 3,
    formats: ['avif', 'webp', 'jpeg'],
  },
  {
    id: 'phone-webp',
    label: '휴대폰 · 390px · DPR 2 · WebP 까지',
    cssWidth: 390,
    dpr: 2,
    formats: ['webp', 'jpeg'],
  },
  {
    id: 'tablet',
    label: '태블릿 · 768px · DPR 2 · AVIF 지원',
    cssWidth: 768,
    dpr: 2,
    formats: ['avif', 'webp', 'jpeg'],
  },
  {
    id: 'laptop',
    label: '노트북 · 1440px · DPR 1 · AVIF 지원',
    cssWidth: 1440,
    dpr: 1,
    formats: ['avif', 'webp', 'jpeg'],
  },
  {
    id: 'old-desktop',
    label: '오래된 데스크톱 · 1920px · DPR 1 · JPEG 만',
    cssWidth: 1920,
    dpr: 1,
    formats: ['jpeg'],
  },
];

/** sizes 로 알려 주는 슬롯 너비 (CSS px) */
export function slotWidth(slot: Slot, cssWidth: number): number {
  if (slot === 'full') return cssWidth;
  if (slot === 'half') return cssWidth / 2;
  return FIXED_SLOT;
}

/** 슬롯 너비 × DPR 이 이상적인 픽셀 너비예요. 같은 값이 없으면 그보다 큰 첫 후보를 골라요 */
export function pickWidth(target: number, candidates: readonly number[]): number {
  const sorted = [...candidates].sort((a, b) => a - b);
  return sorted.find((w) => w >= target) ?? sorted[sorted.length - 1];
}

/** 서버가 Accept 로 협상해요. 켜져 있고 기기가 읽을 수 있는 가장 가벼운 형식을 골라요 */
export function negotiate(device: Device, enabled: readonly Format[]): Format {
  for (const f of ['avif', 'webp'] as const) {
    if (device.formats.includes(f) && enabled.includes(f)) return f;
  }
  return 'jpeg';
}

/** srcset 후보 너비 목록. 원본을 마지막 후보로 둬요 */
function candidateWidths(widths: readonly number[]): number[] {
  return [...new Set([...widths, ORIGINAL_WIDTH])].sort((a, b) => a - b);
}

/** 한 기기가 한 장을 요청할 때 받는 파일을 정해요 */
export function choose(device: Device, slot: Slot, widths: readonly number[], formats: readonly Format[]): Choice {
  const target = slotWidth(slot, device.cssWidth) * device.dpr;
  const width = pickWidth(target, candidateWidths(widths));
  const format = width === ORIGINAL_WIDTH ? 'jpeg' : negotiate(device, formats);
  return { width, format, bytes: variantBytes(width, format) };
}

export function srcsetText(widths: readonly number[]): string {
  return candidateWidths(widths)
    .map((w) => `/img/hero?w=${w} ${w}w`)
    .join(', ');
}

export function sizesText(slot: Slot): string {
  if (slot === 'full') return '100vw';
  if (slot === 'half') return '50vw';
  return `${FIXED_SLOT}px`;
}

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

/** 같은 seed 면 항상 같은 요청 순서가 나와요 */
export function makeStream(
  seed: number,
  slot: Slot,
  widths: readonly number[],
  formats: readonly Format[],
  count: number = REQUEST_COUNT,
): Req[] {
  const rng = mulberry32(seed);
  const reqs: Req[] = [];
  for (let i = 0; i < count; i++) {
    const device = DEVICES[Math.floor(rng() * DEVICES.length)];
    const image = Math.floor(rng() * IMAGE_COUNT);
    // 같은 형식을 쓰는 브라우저도 버전에 따라 Accept 원문이 조금씩 달라요
    const build = Math.floor(rng() * 4);
    const choice = choose(device, slot, widths, formats);
    reqs.push({
      image,
      width: choice.width,
      format: choice.format,
      accept: `${device.formats.map((f) => `image/${f}`).join(',')};build=${build}`,
    });
  }
  return reqs;
}

function keyOf(policy: KeyPolicy, r: Req): string {
  switch (policy) {
    case 'path':
      return `img${r.image}`;
    case 'width':
      return `img${r.image}|w${r.width}`;
    case 'width-format':
      return `img${r.image}|w${r.width}|${r.format}`;
    case 'query-accept':
      return `img${r.image}|w${r.width}|${r.accept}`;
  }
}

/**
 * 단일 캐시 계층 · 용량 무제한 · TTL 없음을 가정해요.
 * 그래서 원본 요청 수 = 미스 수이고, 미스 수는 서로 다른 캐시 키 수와 같아요.
 */
export function runCache(policy: KeyPolicy, stream: readonly Req[]): PolicyResult {
  const store = new Map<string, { width: number; format: Format }>();
  let hits = 0;
  let wrong = 0;
  for (const r of stream) {
    const key = keyOf(policy, r);
    const cached = store.get(key);
    if (cached) {
      hits++;
      if (cached.width !== r.width || cached.format !== r.format) wrong++;
    } else {
      store.set(key, { width: r.width, format: r.format });
    }
  }
  const requests = stream.length;
  return {
    policy,
    requests,
    hits,
    originRequests: requests - hits,
    wrong,
    hitRatio: requests === 0 ? 0 : hits / requests,
  };
}

export const POLICIES: readonly { value: KeyPolicy; label: string; hint: string }[] = [
  { value: 'path', label: '경로만', hint: '쿼리를 무시해요. 모든 크기가 한 키로 묶여요.' },
  { value: 'width', label: '크기만 (w)', hint: '크기는 나누지만 형식은 보지 않아요.' },
  {
    value: 'width-format',
    label: '크기 + 형식 등급',
    hint: 'Accept 를 형식 등급으로 줄여 키에 넣어요. Vary: Accept 와 같은 효과예요.',
  },
  {
    value: 'query-accept',
    label: '쿼리 전체 + Accept 원문',
    hint: 'Accept 문자열 전체를 키에 넣어요. 같은 형식도 키가 잘게 쪼개져요.',
  },
];

/** 이미지 한 장이 바뀔 때 URL 기준으로 무효화해야 하는 수 */
export function purgeTargets(widths: readonly number[], formats: readonly Format[], hashedNames: boolean): number {
  if (hashedNames) return 0;
  const formatSet = new Set<Format>([...formats, 'jpeg']);
  // 변형 너비 × 형식 조합 + 원본 1개
  const variants = new Set(widths).size * formatSet.size;
  return IMAGE_COUNT * (variants + 1);
}

export function runAll(
  seed: number,
  slot: Slot,
  widths: readonly number[],
  formats: readonly Format[],
): PolicyResult[] {
  const stream = makeStream(seed, slot, widths, formats);
  return POLICIES.map((p) => runCache(p.value, stream));
}
