import { describe, expect, it } from 'vitest';
import {
  CENTER,
  CLUSTER_GRID,
  CLUSTER_ZOOM,
  LIMIT,
  type Params,
  type Strategy,
  makePoints,
  planarDistanceM,
  precisionMeters,
  roundCoord,
  simulate,
  sphereDistanceM,
  viewportAt,
} from './model';

const base: Params = { points: 800, zoom: 9, strategy: 'scan', cluster: false, seed: 7 };
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const ZOOMS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STRATEGIES: Strategy[] = ['scan', 'bbox', 'cell'];

describe('거리 계산', () => {
  it('위도 1도 차이는 구 반지름 가정으로 약 111.2km 예요', () => {
    const d = sphereDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(Math.abs(d - 111_195)).toBeLessThan(10);
  });

  it('2km 안쪽에서는 평면 근사와 구면 거리의 차이가 0.1% 아래예요', () => {
    const a = { lat: CENTER.lat, lng: CENTER.lng };
    const b = { lat: CENTER.lat + 0.01, lng: CENTER.lng + 0.01 };
    const exact = sphereDistanceM(a, b);
    const approx = planarDistanceM(a, b);
    expect(exact).toBeLessThan(2000);
    expect(Math.abs(approx - exact) / exact).toBeLessThan(1e-3);
  });

  it('멀리 떨어진 점에서는 평면 근사의 상대 오차가 짧은 구간보다 커요', () => {
    const relError = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const exact = sphereDistanceM(a, b);
      return Math.abs(planarDistanceM(a, b) - exact) / exact;
    };
    const near = relError({ lat: 37.5, lng: 127 }, { lat: 37.51, lng: 127.01 });
    const far = relError({ lat: 60, lng: 0 }, { lat: -20, lng: 150 });
    expect(far).toBeGreaterThan(near);
  });
});

describe('좌표 정밀도', () => {
  it('소수 다섯째 자리는 약 1.1m, 셋째 자리는 약 111m 예요', () => {
    expect(Math.abs(precisionMeters(5) - 1.11)).toBeLessThan(0.01);
    expect(Math.abs(precisionMeters(3) - 111.19)).toBeLessThan(0.01);
  });

  it('소수 자리에서 반올림해요', () => {
    expect(roundCoord(37.123456, 5)).toBe(37.12346);
    expect(roundCoord(127.1, 3)).toBe(127.1);
  });
});

describe('지도 영역과 점 배치', () => {
  it('줌이 1 늘 때마다 영역의 폭이 절반이 돼요', () => {
    for (const z of [8, 9, 10, 11]) {
      const wide = viewportAt(z);
      const narrow = viewportAt(z + 1);
      expect(narrow.east - narrow.west).toBeCloseTo((wide.east - wide.west) / 2, 10);
    }
  });

  it('같은 시드는 같은 점 배치를 만들어요', () => {
    expect(makePoints(100, 3)).toEqual(makePoints(100, 3));
    expect(makePoints(100, 3)).not.toEqual(makePoints(100, 4));
  });
});

describe('질의 방식별 검사 수', () => {
  it('전체 스캔은 점 전부를 검사해요', () => {
    for (const seed of SEEDS) {
      for (const zoom of ZOOMS) {
        expect(simulate({ ...base, strategy: 'scan', seed, zoom }).examined).toBe(base.points);
      }
    }
  });

  it('경계 상자 인덱스는 검사 수가 화면 안 점 수와 같아요', () => {
    for (const seed of SEEDS) {
      for (const zoom of ZOOMS) {
        const r = simulate({ ...base, strategy: 'bbox', seed, zoom });
        expect(r.examined).toBe(r.matched);
      }
    }
  });

  it('격자 셀 인덱스는 화면 안 점 수 이상이고 전체 점 수 이하예요', () => {
    for (const seed of SEEDS) {
      for (const zoom of ZOOMS) {
        const r = simulate({ ...base, strategy: 'cell', seed, zoom });
        expect(r.examined).toBeGreaterThanOrEqual(r.matched);
        expect(r.examined).toBeLessThanOrEqual(base.points);
      }
    }
  });

  it('같은 화면을 세 방식으로 보면 화면 안 점 수는 같아요', () => {
    for (const seed of SEEDS) {
      const counts = STRATEGIES.map((strategy) => simulate({ ...base, strategy, seed }).matched);
      expect(new Set(counts).size).toBe(1);
    }
  });
});

describe('응답 개수 제한과 클러스터링', () => {
  it('묶지 않으면 응답은 상한을 넘지 않고, 빠진 점 수를 알려 줘요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, zoom: 8, seed });
      expect(r.returned).toBeLessThanOrEqual(LIMIT);
      expect(r.cut).toBe(r.matched - r.returned);
      expect(r.cut).toBeGreaterThanOrEqual(0);
    }
  });

  it('묶으면 묶음 개수는 칸 수를 넘지 않고, 개수 합은 화면 안 점 수와 같아요', () => {
    for (const seed of SEEDS) {
      const r = simulate({ ...base, zoom: 9, cluster: true, seed });
      expect(r.clustered).toBe(true);
      expect(r.groups.length).toBeLessThanOrEqual(CLUSTER_GRID * CLUSTER_GRID);
      expect(r.groups.reduce((sum, g) => sum + g.count, 0)).toBe(r.matched);
      expect(r.cut).toBe(0);
    }
  });

  it('줌이 클러스터링 기준 이상이면 묶지 않아요', () => {
    const r = simulate({ ...base, zoom: CLUSTER_ZOOM, cluster: true });
    expect(r.clustered).toBe(false);
    expect(r.groups).toHaveLength(0);
  });

  it('응답 크기는 응답 항목 수에 비례해요', () => {
    const plain = simulate({ ...base, zoom: 10 });
    expect(plain.bytes).toBe(plain.returned * 90);
    const grouped = simulate({ ...base, zoom: 10, cluster: true });
    expect(grouped.bytes).toBe(grouped.returned * 120);
  });
});
