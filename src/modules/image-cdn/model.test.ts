import { describe, expect, it } from 'vitest';
import {
  ALL_FORMATS,
  ALL_WIDTHS,
  DEVICES,
  choose,
  makeStream,
  ORIGINAL_BYTES,
  ORIGINAL_WIDTH,
  pickWidth,
  purgeTargets,
  runAll,
  runCache,
  srcsetText,
  variantBytes,
} from './model';

const byDevice = (id: string) => DEVICES.find((d) => d.id === id)!;
const resultOf = (seed: number, slot: 'full' | 'half' | 'fixed', formats: readonly ('avif' | 'webp' | 'jpeg')[]) =>
  Object.fromEntries(runAll(seed, slot, ALL_WIDTHS, formats).map((r) => [r.policy, r]));

describe('srcset 후보 고르기', () => {
  it('슬롯 너비 × DPR 과 같거나 큰 첫 후보를 고르고, 없으면 원본을 골라요', () => {
    expect(pickWidth(750, ALL_WIDTHS)).toBe(960);
    expect(pickWidth(640, ALL_WIDTHS)).toBe(640);
    expect(pickWidth(2000, [...ALL_WIDTHS, ORIGINAL_WIDTH])).toBe(ORIGINAL_WIDTH);
    expect(pickWidth(2000, ALL_WIDTHS)).toBe(1920);
    expect(pickWidth(100, ALL_WIDTHS)).toBe(320);
  });

  it('DPR 3 휴대폰이 화면 전체 슬롯을 쓰면 1125px 이상인 1280 변형을 받아요', () => {
    const c = choose(byDevice('phone-modern'), 'full', ALL_WIDTHS, ALL_FORMATS);
    expect(c.width).toBe(1280);
    expect(c.format).toBe('avif');
  });

  it('같은 기기라도 슬롯을 절반으로 줄이면 더 작은 파일을 받아요', () => {
    const full = choose(byDevice('phone-modern'), 'full', ALL_WIDTHS, ALL_FORMATS);
    const half = choose(byDevice('phone-modern'), 'half', ALL_WIDTHS, ALL_FORMATS);
    expect(half.bytes).toBeLessThan(full.bytes);
  });

  it('변형 목록을 모두 끄면 원본을 받아요', () => {
    const c = choose(byDevice('phone-modern'), 'full', [], ALL_FORMATS);
    expect(c.width).toBe(ORIGINAL_WIDTH);
    expect(c.bytes).toBe(ORIGINAL_BYTES);
  });

  it('AVIF 를 꺼 두면 AVIF 를 읽는 기기도 WebP 를 받아요', () => {
    const c = choose(byDevice('phone-modern'), 'full', ALL_WIDTHS, ['webp', 'jpeg']);
    expect(c.format).toBe('webp');
  });

  it('JPEG 만 읽는 기기는 AVIF 를 켜 놔도 JPEG 를 받아요', () => {
    const c = choose(byDevice('old-desktop'), 'full', ALL_WIDTHS, ALL_FORMATS);
    expect(c.format).toBe('jpeg');
  });

  it('srcset 문자열에는 변형 너비와 원본이 모두 들어가요', () => {
    const text = srcsetText([640, 320]);
    expect(text).toBe('/img/hero?w=320 320w, /img/hero?w=640 640w, /img/hero?w=2400 2400w');
  });
});

describe('파일 크기 계수', () => {
  it('같은 너비에서는 AVIF < WebP < JPEG 순으로 작아요', () => {
    expect(variantBytes(960, 'avif')).toBeLessThan(variantBytes(960, 'webp'));
    expect(variantBytes(960, 'webp')).toBeLessThan(variantBytes(960, 'jpeg'));
  });

  it('같은 형식에서는 너비가 클수록 커요', () => {
    for (let i = 1; i < ALL_WIDTHS.length; i++) {
      expect(variantBytes(ALL_WIDTHS[i], 'webp')).toBeGreaterThan(variantBytes(ALL_WIDTHS[i - 1], 'webp'));
    }
  });

  it('휴대폰 기본 선택은 원본보다 크게 작아요', () => {
    const c = choose(byDevice('phone-modern'), 'full', ALL_WIDTHS, ALL_FORMATS);
    expect(c.bytes).toBeLessThan(ORIGINAL_BYTES / 5);
  });
});

describe('요청 순서', () => {
  it('같은 seed 면 항상 같은 요청 순서가 나와요', () => {
    const a = makeStream(42, 'full', ALL_WIDTHS, ALL_FORMATS);
    const b = makeStream(42, 'full', ALL_WIDTHS, ALL_FORMATS);
    expect(a).toEqual(b);
  });

  it('seed 가 다르면 요청 순서도 달라요', () => {
    const a = makeStream(1, 'full', ALL_WIDTHS, ALL_FORMATS);
    const b = makeStream(2, 'full', ALL_WIDTHS, ALL_FORMATS);
    expect(a).not.toEqual(b);
  });
});

describe('캐시 키에 따른 적중률과 잘못된 응답', () => {
  it('경로만 키로 쓰면 적중률이 가장 높아 보여도 다른 크기 파일을 가장 많이 돌려줘요', () => {
    const r = resultOf(7, 'full', ALL_FORMATS);
    expect(r.path.wrong).toBeGreaterThan(0);
    expect(r.path.hitRatio).toBeGreaterThanOrEqual(r.width.hitRatio);
    expect(r.path.wrong).toBeGreaterThan(r.width.wrong);
  });

  it('크기만 키로 쓰면 형식이 섞이는 기기에서 잘못된 응답이 나와요', () => {
    const r = resultOf(7, 'full', ALL_FORMATS);
    expect(r.width.wrong).toBeGreaterThan(0);
  });

  it('형식을 협상하지 않는 설정이면 크기만 키로 써도 잘못된 응답이 없어요', () => {
    const r = resultOf(7, 'full', ['jpeg']);
    expect(r.width.wrong).toBe(0);
  });

  it('크기와 형식 등급을 키에 넣으면 잘못된 응답이 없어요', () => {
    for (const seed of [1, 7, 99]) {
      for (const slot of ['full', 'half', 'fixed'] as const) {
        const r = resultOf(seed, slot, ALL_FORMATS);
        expect(r['width-format'].wrong).toBe(0);
        expect(r['query-accept'].wrong).toBe(0);
      }
    }
  });

  it('Accept 원문을 키에 넣으면 같은 형식도 키가 쪼개져 원본 요청이 더 많아요', () => {
    const r = resultOf(7, 'full', ALL_FORMATS);
    expect(r['query-accept'].originRequests).toBeGreaterThan(r['width-format'].originRequests);
  });

  it('같은 요청 순서에서 키를 덜 나눈 쪽이 원본 요청을 덜 보내요', () => {
    const stream = makeStream(7, 'full', ALL_WIDTHS, ALL_FORMATS);
    const path = runCache('path', stream);
    const width = runCache('width', stream);
    expect(path.originRequests).toBeLessThanOrEqual(width.originRequests);
    expect(path.hits + path.originRequests).toBe(stream.length);
  });

  it('같은 입력이면 결과가 항상 같아요', () => {
    expect(resultOf(7, 'half', ALL_FORMATS)).toEqual(resultOf(7, 'half', ALL_FORMATS));
  });
});

describe('무효화 대상 수', () => {
  it('URL 기준으로 무효화하면 이미지 12장 × (너비 5 × 형식 3 + 원본 1) 개예요', () => {
    expect(purgeTargets(ALL_WIDTHS, ALL_FORMATS, false)).toBe(12 * (5 * 3 + 1));
  });

  it('해시 파일 이름을 쓰면 무효화 대상이 없어요', () => {
    expect(purgeTargets(ALL_WIDTHS, ALL_FORMATS, true)).toBe(0);
  });
});
