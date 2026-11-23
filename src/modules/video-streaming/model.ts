/**
 * 동영상 전달 순수 모델. 시간을 DT 단위로 나눠 네트워크 대역폭, 다운로드, 재생 버퍼를 진행해요.
 * 모든 수치(Mbps, 초, 버퍼 기준)는 감을 잡기 위한 예시예요. 실제 플레이어 값이 아니에요.
 */

export type NetworkId = 'steady' | 'dip' | 'flicker';
export type DeliveryId = 'original' | 'fixed' | 'adaptive';
export type PlayState = 'waiting' | 'playing' | 'stalled' | 'ended';

/** 예시 대역폭 구간. from 이상 to 미만에서 mbps 가 유지돼요 */
export interface BandwidthSpan {
  readonly from: number;
  readonly to: number;
  readonly mbps: number;
}

export interface Frame {
  readonly at: number;
  readonly mbps: number;
  readonly buffer: number;
  /** 재생 위치의 화질. 재생을 시작하기 전에는 undefined */
  readonly rendition: number | undefined;
  readonly state: PlayState;
}

export interface Result {
  readonly startupSec: number | undefined;
  readonly stallCount: number;
  readonly stallSec: number;
  /** 재생한 구간의 화질 평균 (Mbps, 예시) */
  readonly avgMbps: number;
  /** 화질이 바뀐 횟수 */
  readonly switches: number;
  readonly finished: boolean;
  readonly endSec: number;
  readonly frames: readonly Frame[];
}

/** 영상 길이 (예시) */
export const MEDIA_SECONDS = 60;
/** 시뮬레이션 한 단계 (초) */
export const DT = 0.25;
/** 재생을 시작하거나 멈춤에서 돌아가는 데 필요한 버퍼 (초, 예시) */
export const START_BUFFER = 4;
/** 이 값보다 버퍼가 적으면 적응형 플레이어는 가장 낮은 화질을 고른다 (초, 예시) */
export const LOW_BUFFER = 6;
/** 이 버퍼가 차면 새 세그먼트를 받지 않는다 (초, 예시) */
export const TARGET_BUFFER = 24;
/** 측정한 처리량의 몇 %만 쓸지 정한다 (예시 계수) */
export const SAFETY = 0.8;
/** 이 시간 안에 끝나지 않으면 결과를 미완료로 본다 (초) */
export const LIMIT_SECONDS = 240;
/** 적응형 화질 사다리 (Mbps, 예시). 오름차순 */
export const LADDER: readonly number[] = [0.8, 2.5, 5, 8];

const EPS = 1e-9;

export const NETWORKS: Record<NetworkId, { label: string; hint: string; spans: readonly BandwidthSpan[] }> = {
  steady: {
    label: '안정적인 연결',
    hint: '6 Mbps 를 끝까지 유지해요 (예시).',
    spans: [{ from: 0, to: LIMIT_SECONDS, mbps: 6 }],
  },
  dip: {
    label: '지하철 진입',
    hint: '15초부터 35초까지 0.6 Mbps 로 떨어졌다가 돌아와요 (예시).',
    spans: [
      { from: 0, to: 15, mbps: 10 },
      { from: 15, to: 35, mbps: 0.6 },
      { from: 35, to: LIMIT_SECONDS, mbps: 5 },
    ],
  },
  flicker: {
    label: '흔들리는 모바일 연결',
    hint: '10초마다 1 ~ 5 Mbps 사이로 오르내려요 (예시).',
    spans: [
      { from: 0, to: 10, mbps: 4 },
      { from: 10, to: 20, mbps: 1.5 },
      { from: 20, to: 30, mbps: 4 },
      { from: 30, to: 40, mbps: 1 },
      { from: 40, to: 50, mbps: 5 },
      { from: 50, to: LIMIT_SECONDS, mbps: 2 },
    ],
  },
};

export const DELIVERIES: Record<
  DeliveryId,
  { label: string; hint: string; renditions: readonly number[]; chunkSeconds: number }
> = {
  original: {
    label: '원본 하나',
    hint: '8 Mbps 원본 한 파일을 1초 단위 범위 요청으로 받아요 (예시).',
    renditions: [8],
    chunkSeconds: 1,
  },
  fixed: {
    label: '고정 화질 세그먼트',
    hint: '3 Mbps 한 가지 화질을 6초 세그먼트로 받아요 (예시).',
    renditions: [3],
    chunkSeconds: 6,
  },
  adaptive: {
    label: '적응형',
    hint: '0.8 · 2.5 · 5 · 8 Mbps 중에서 세그먼트마다 연결에 맞춰 골라요 (예시).',
    renditions: LADDER,
    chunkSeconds: 6,
  },
};

/** 시각 t 의 대역폭. 마지막 구간 뒤에는 마지막 값을 유지해요 */
export function bandwidthAt(spans: readonly BandwidthSpan[], t: number): number {
  const hit = spans.find((s) => t >= s.from && t < s.to);
  return (hit ?? spans[spans.length - 1]).mbps;
}

/** 다음 세그먼트 화질. 단일 화질은 그대로, 적응형은 버퍼와 측정 처리량을 같이 본다 */
export function pickRendition(renditions: readonly number[], lastMbps: number | undefined, buffer: number): number {
  if (renditions.length === 1) return renditions[0];
  const lowest = renditions[0];
  if (lastMbps === undefined || buffer < LOW_BUFFER) return lowest;
  const budget = SAFETY * lastMbps;
  let pick = lowest;
  for (const r of renditions) if (r <= budget) pick = r;
  return pick;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function simulate(network: NetworkId, delivery: DeliveryId): Result {
  const cfg = DELIVERIES[delivery];
  const spans = NETWORKS[network].spans;
  const chunkCount = Math.ceil(MEDIA_SECONDS / cfg.chunkSeconds);
  const renditions: number[] = [];

  let nextChunk = 0;
  let inFlight: { rendition: number; remaining: number; size: number; startedAt: number; chunkSec: number } | undefined;
  let buffer = 0;
  let played = 0;
  let state: PlayState = 'waiting';
  let startupSec: number | undefined;
  let stallCount = 0;
  let stallSec = 0;
  let qualitySum = 0;
  let lastMbps: number | undefined;
  let endSec = LIMIT_SECONDS;
  const frames: Frame[] = [];

  const playheadRendition = () => {
    if (state === 'waiting') return undefined;
    const idx = Math.min(chunkCount - 1, Math.floor(played / cfg.chunkSeconds + EPS));
    return renditions[idx];
  };
  const snapshot = (t: number): Frame => ({
    at: round2(t),
    mbps: bandwidthAt(spans, t),
    buffer: round1(buffer),
    rendition: playheadRendition(),
    state,
  });

  const steps = Math.round(LIMIT_SECONDS / DT);
  for (let i = 0; i <= steps; i++) {
    const t = round2(i * DT);
    if (i % 20 === 0) frames.push(snapshot(t));
    if (state === 'ended') break;

    // 1) 네트워크가 실어 나를 수 있는 만큼 세그먼트를 받아요. 순서대로 한 줄씩 받아요.
    let budget = bandwidthAt(spans, t) * DT;
    while (budget > EPS) {
      if (!inFlight) {
        if (nextChunk >= chunkCount || buffer >= TARGET_BUFFER) break;
        const rendition = pickRendition(cfg.renditions, lastMbps, buffer);
        const chunkSec = Math.min(cfg.chunkSeconds, MEDIA_SECONDS - nextChunk * cfg.chunkSeconds);
        const size = rendition * chunkSec;
        inFlight = { rendition, remaining: size, size, startedAt: t, chunkSec };
        renditions[nextChunk] = rendition;
        nextChunk++;
      }
      const used = Math.min(budget, inFlight.remaining);
      inFlight.remaining -= used;
      budget -= used;
      if (inFlight.remaining <= EPS) {
        const elapsed = Math.max(round2(t + DT - inFlight.startedAt), DT);
        lastMbps = inFlight.size / elapsed;
        buffer += inFlight.chunkSec;
        inFlight = undefined;
      }
    }

    // 2) 재생 상태를 갱신해요. 버퍼가 비면 멈추고, 다시 채워지면 재생해요.
    const fetchedAll = nextChunk >= chunkCount && !inFlight;
    if (state === 'waiting' || state === 'stalled') {
      if (state === 'stalled') stallSec += DT;
      if (buffer >= START_BUFFER - EPS || (fetchedAll && buffer > EPS)) {
        if (startupSec === undefined) startupSec = t;
        state = 'playing';
      }
    }
    if (state === 'playing') {
      if (buffer > EPS) {
        const adv = Math.min(DT, buffer, MEDIA_SECONDS - played);
        const idx = Math.min(chunkCount - 1, Math.floor(played / cfg.chunkSeconds + EPS));
        qualitySum += renditions[idx] * adv;
        buffer -= adv;
        played += adv;
        if (played >= MEDIA_SECONDS - EPS) {
          state = 'ended';
          endSec = t;
        }
      } else {
        state = 'stalled';
        stallCount++;
      }
    }
  }

  frames.push(snapshot(state === 'ended' ? endSec : LIMIT_SECONDS));

  let switches = 0;
  for (let i = 1; i < renditions.length; i++) if (renditions[i] !== renditions[i - 1]) switches++;

  return {
    startupSec,
    stallCount,
    stallSec: round2(stallSec),
    avgMbps: played > 0 ? round2(qualitySum / played) : 0,
    switches,
    finished: state === 'ended',
    endSec: state === 'ended' ? endSec : LIMIT_SECONDS,
    frames,
  };
}
