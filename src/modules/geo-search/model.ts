export type Strategy = 'scan' | 'bbox' | 'cell';

export const STRATEGIES: readonly Strategy[] = ['scan', 'bbox', 'cell'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  scan: '전체 스캔',
  bbox: '경계 상자 인덱스',
  cell: '격자 셀 인덱스',
};

/** 가짜 점이 깔린 영역의 한 변 (도). 예시 값 */
export const AREA = 1;
/** 예시 중심 좌표. 실제 장소가 아니에요 */
export const CENTER = { lat: 37.5, lng: 127 } as const;
/** 격자 셀 한 변 (도). 예시 값 */
export const CELL = 0.05;
/** 응답으로 돌려주는 점 개수 상한. 예시 값 */
export const LIMIT = 200;
/** 이 줌 미만에서만 서버가 묶어서 보내요. 설계 판단 */
export const CLUSTER_ZOOM = 13;
/** 클러스터링할 때 화면을 나누는 칸 수 (한 축). 예시 값 */
export const CLUSTER_GRID = 8;
/** 점 하나의 응답 크기 (바이트). 예시 값 */
export const BYTES_POINT = 90;
/** 묶음 하나의 응답 크기 (바이트). 예시 값 */
export const BYTES_GROUP = 120;
/** 구 반지름 가정 (미터). 계산용 예시 가정이에요 */
export const EARTH_RADIUS_M = 6_371_000;
export const MIN_ZOOM = 8;
export const MAX_ZOOM = 16;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface Point extends LatLng {
  readonly id: number;
}

export interface Viewport {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

export interface Group extends LatLng {
  readonly count: number;
}

export interface Params {
  readonly points: number;
  readonly zoom: number;
  readonly strategy: Strategy;
  readonly cluster: boolean;
  readonly seed: number;
}

export interface Result {
  readonly viewport: Viewport;
  readonly total: number;
  /** 가짜 점 전체 (지도에 흐리게 그려요) */
  readonly points: readonly Point[];
  /** 질의가 검사한 점 수 */
  readonly examined: number;
  /** 화면 영역 안에 있는 점 수 */
  readonly matched: number;
  /** 응답에 담은 항목 수 (묶음이면 묶음 수) */
  readonly returned: number;
  /** 화면 안에 있지만 응답에 빠진 점 수 */
  readonly cut: number;
  readonly bytes: number;
  readonly clustered: boolean;
  readonly shown: readonly Point[];
  readonly groups: readonly Group[];
  /** 격자 셀 방식에서 검사한 셀 */
  readonly cells: readonly { readonly row: number; readonly col: number }[];
}

const RAD = Math.PI / 180;
const SW = { lat: CENTER.lat - AREA / 2, lng: CENTER.lng - AREA / 2 } as const;

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

/** 소수 자리에서 반올림한다 */
export function roundCoord(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** 소수 자리 수가 정하는 대략적인 정밀도 (미터). 구 반지름 가정으로 계산한 예시 값 */
export function precisionMeters(digits: number): number {
  return (2 * Math.PI * EARTH_RADIUS_M) / 360 / 10 ** digits;
}

/** 구면 거리. 하버사인 공식을 써요 (구 모형) */
export function sphereDistanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 평면 근사. 경도 차에 두 점 위도의 평균 cos 를 곱해 평평한 격자로 봐요 */
export function planarDistanceM(a: LatLng, b: LatLng): number {
  const x = (b.lng - a.lng) * RAD * Math.cos(((a.lat + b.lat) / 2) * RAD);
  const y = (b.lat - a.lat) * RAD;
  return EARTH_RADIUS_M * Math.sqrt(x * x + y * y);
}

/** 줌마다 경도 폭이 절반이 되는 예시 모델. 지도 중심은 CENTER 예요 */
export function viewportAt(zoom: number): Viewport {
  const span = 360 / 2 ** zoom;
  return {
    south: CENTER.lat - span / 2,
    north: CENTER.lat + span / 2,
    west: CENTER.lng - span / 2,
    east: CENTER.lng + span / 2,
  };
}

export function makePoints(count: number, seed: number): Point[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, id) => ({
    id,
    lat: roundCoord(SW.lat + rnd() * AREA, 5),
    lng: roundCoord(SW.lng + rnd() * AREA, 5),
  }));
}

const cellRow = (lat: number) => Math.floor((lat - SW.lat) / CELL);
const cellCol = (lng: number) => Math.floor((lng - SW.lng) / CELL);
const cellKey = (row: number, col: number) => `${row}:${col}`;

export function inside(vp: Viewport, p: LatLng): boolean {
  return p.lat >= vp.south && p.lat <= vp.north && p.lng >= vp.west && p.lng <= vp.east;
}

/** 영역과 겹치는 격자 셀 목록 */
export function cellsOver(vp: Viewport): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let row = cellRow(vp.south); row <= cellRow(vp.north); row++) {
    for (let col = cellCol(vp.west); col <= cellCol(vp.east); col++) {
      out.push({ row, col });
    }
  }
  return out;
}

/** 화면 영역을 CLUSTER_GRID 칸으로 나눠 칸마다 개수와 평균 좌표를 돌려줘요 */
export function clusterHits(hits: readonly Point[], vp: Viewport): Group[] {
  const h = (vp.north - vp.south) / CLUSTER_GRID;
  const w = (vp.east - vp.west) / CLUSTER_GRID;
  const acc = new Map<string, { lat: number; lng: number; count: number }>();
  for (const p of hits) {
    const r = Math.min(CLUSTER_GRID - 1, Math.floor((p.lat - vp.south) / h));
    const c = Math.min(CLUSTER_GRID - 1, Math.floor((p.lng - vp.west) / w));
    const key = cellKey(r, c);
    const a = acc.get(key) ?? { lat: 0, lng: 0, count: 0 };
    acc.set(key, { lat: a.lat + p.lat, lng: a.lng + p.lng, count: a.count + 1 });
  }
  return [...acc.values()].map((a) => ({ lat: a.lat / a.count, lng: a.lng / a.count, count: a.count }));
}

export function simulate(p: Params): Result {
  const points = makePoints(p.points, p.seed);
  const vp = viewportAt(p.zoom);

  let examined: number;
  let hits: Point[];
  let cells: { row: number; col: number }[] = [];

  if (p.strategy === 'scan') {
    examined = points.length;
    hits = points.filter((pt) => inside(vp, pt));
  } else if (p.strategy === 'bbox') {
    // 이상적인 공간 인덱스를 가정해요. 상자 안 점만 찾는다고 보고 검사 수를 화면 안 점 수로 둬요
    hits = points.filter((pt) => inside(vp, pt));
    examined = hits.length;
  } else {
    cells = cellsOver(vp);
    const keys = new Set(cells.map((c) => cellKey(c.row, c.col)));
    const candidates = points.filter((pt) => keys.has(cellKey(cellRow(pt.lat), cellCol(pt.lng))));
    examined = candidates.length;
    hits = candidates.filter((pt) => inside(vp, pt));
  }

  const clustered = p.cluster && p.zoom < CLUSTER_ZOOM;
  if (clustered) {
    const groups = clusterHits(hits, vp);
    return {
      viewport: vp,
      total: points.length,
      points,
      examined,
      matched: hits.length,
      returned: groups.length,
      cut: 0,
      bytes: groups.length * BYTES_GROUP,
      clustered,
      shown: [],
      groups,
      cells,
    };
  }

  const shown = hits.slice(0, LIMIT);
  return {
    viewport: vp,
    total: points.length,
    points,
    examined,
    matched: hits.length,
    returned: shown.length,
    cut: hits.length - shown.length,
    bytes: shown.length * BYTES_POINT,
    clustered,
    shown,
    groups: [],
    cells,
  };
}
