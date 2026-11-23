import { describe, expect, it } from 'vitest';
import {
  DELIVERIES,
  type DeliveryId,
  LADDER,
  MEDIA_SECONDS,
  type NetworkId,
  NETWORKS,
  pickRendition,
  simulate,
  TARGET_BUFFER,
} from './model';

const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];
const DELIVERY_IDS = Object.keys(DELIVERIES) as DeliveryId[];

describe('재생 시뮬레이션', () => {
  it('같은 연결과 같은 방식이면 항상 같은 결과가 나와요', () => {
    expect(simulate('flicker', 'adaptive')).toEqual(simulate('flicker', 'adaptive'));
  });

  it('모든 조합에서 영상이 제한 시간 안에 끝까지 재생돼요', () => {
    for (const n of NETWORK_IDS)
      for (const d of DELIVERY_IDS) expect(simulate(n, d).finished, `${n} · ${d}`).toBe(true);
  });

  it('원본 하나는 안정적인 6 Mbps 연결에서도 8 Mbps 를 따라가지 못해 멈춰요', () => {
    const original = simulate('steady', 'original');
    expect(original.stallCount).toBeGreaterThan(0);
    expect(original.stallSec).toBeGreaterThan(0);
  });

  it('고정 화질 3 Mbps 는 안정적인 연결에서 멈추지 않아요', () => {
    const fixed = simulate('steady', 'fixed');
    expect(fixed.stallCount).toBe(0);
    expect(fixed.avgMbps).toBe(3);
  });

  it('원본은 첫 화면까지 고정 화질보다 오래 걸려요', () => {
    expect(simulate('steady', 'original').startupSec!).toBeGreaterThan(simulate('steady', 'fixed').startupSec!);
  });

  it('흔들리는 연결에서 멈춤은 원본 > 고정 화질 > 적응형 순서로 줄어요', () => {
    const original = simulate('flicker', 'original');
    const fixed = simulate('flicker', 'fixed');
    const adaptive = simulate('flicker', 'adaptive');
    expect(original.stallSec).toBeGreaterThan(fixed.stallSec);
    expect(fixed.stallSec).toBeGreaterThan(adaptive.stallSec);
    expect(adaptive.stallCount).toBe(0);
  });

  it('적응형은 측정한 처리량의 80% 안에서 가장 높은 화질을 골라요', () => {
    const adaptive = simulate('steady', 'adaptive');
    // 6 Mbps 의 80% 는 4.8 Mbps 라서 5 Mbps 는 고르지 않고 2.5 Mbps 가 최고예요
    expect(adaptive.frames.some((f) => f.rendition === 2.5)).toBe(true);
    expect(adaptive.frames.some((f) => f.rendition !== undefined && f.rendition >= 5)).toBe(false);
  });

  it('적응형 화질은 연결이 바뀌면 함께 바뀌어요', () => {
    expect(simulate('flicker', 'adaptive').switches).toBeGreaterThan(0);
    expect(simulate('steady', 'fixed').switches).toBe(0);
  });

  it('버퍼는 목표 크기 근처에서 멈춰요', () => {
    for (const d of DELIVERY_IDS) {
      const maxBuffer = Math.max(...simulate('steady', d).frames.map((f) => f.buffer));
      expect(maxBuffer).toBeLessThanOrEqual(TARGET_BUFFER + 6);
    }
  });
});

describe('화질 선택 규칙', () => {
  it('단일 화질은 버퍼와 상관없이 그 화질을 골라요', () => {
    expect(pickRendition([3], 100, 0)).toBe(3);
  });

  it('처리량 정보가 없거나 버퍼가 적으면 가장 낮은 화질을 골라요', () => {
    expect(pickRendition(LADDER, undefined, 30)).toBe(LADDER[0]);
    expect(pickRendition(LADDER, 100, 2)).toBe(LADDER[0]);
  });

  it('처리량의 80% 를 넘지 않는 가장 높은 화질을 골라요', () => {
    expect(pickRendition(LADDER, 7, 30)).toBe(5);
    expect(pickRendition(LADDER, 10, 30)).toBe(8);
  });

  it('영상 길이는 상수와 같아요', () => {
    expect(MEDIA_SECONDS).toBe(60);
  });
});
