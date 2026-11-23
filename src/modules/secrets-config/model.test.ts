import { moduleById } from '..';
import { describe, expect, it } from 'vitest';
import {
  type Choice,
  type ConfigItem,
  DEFAULT_CHOICES,
  ITEMS,
  judge,
  LEAK_STEPS,
  nameOf,
  PRESETS,
  type Placement,
  review,
  type Tool,
} from './model';

const PLACEMENTS: readonly Placement[] = ['build', 'server', 'vault'];
const TOOLS: readonly Tool[] = ['vite', 'next'];

const item = (id: string): ConfigItem => {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`없는 항목: ${id}`);
  return found;
};

const preset = (id: string) => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`없는 예시: ${id}`);
  return found;
};

/** 모든 조합: 도구 × 항목 × 위치 × 접두 여부 */
function allCases() {
  const out: { tool: Tool; item: ConfigItem; choice: Choice }[] = [];
  for (const tool of TOOLS)
    for (const it of ITEMS)
      for (const placement of PLACEMENTS)
        for (const prefixed of [false, true]) out.push({ tool, item: it, choice: { placement, prefixed } });
  return out;
}

describe('접두 규칙', () => {
  it('Vite 는 VITE_ 를, Next.js 는 NEXT_PUBLIC_ 를 붙여요', () => {
    const map = item('map');
    expect(nameOf('vite', map, { placement: 'build', prefixed: true })).toBe('VITE_MAP_KEY');
    expect(nameOf('next', map, { placement: 'build', prefixed: true })).toBe('NEXT_PUBLIC_MAP_KEY');
  });

  it('접두를 붙이지 않으면 이름이 그대로 남아요', () => {
    expect(nameOf('vite', item('db'), { placement: 'build', prefixed: false })).toBe('DB_PASSWORD');
  });
});

describe('번들 포함 여부', () => {
  it('빌드 환경에 있고 접두가 붙은 값만 번들에 들어가요', () => {
    for (const { tool, item: it, choice } of allCases()) {
      const { bundleLines } = review(tool, { ...DEFAULT_CHOICES, [it.id]: choice });
      const included = bundleLines.some((line) => line.startsWith(nameOf(tool, it, choice) + ' = '));
      expect(included).toBe(choice.placement === 'build' && choice.prefixed);
    }
  });

  it('번들에 들어간 비밀 값은 모두 노출 판정이에요', () => {
    for (const { tool, item: it, choice } of allCases()) {
      const rows = review(tool, { ...DEFAULT_CHOICES, [it.id]: choice }).rows;
      const bundledSecrets = rows.filter((x) => x.bundled && x.item.kind === 'secret');
      expect(bundledSecrets.every((x) => x.verdict === 'leak')).toBe(true);
    }
  });
});

describe('판정', () => {
  it('Vite 에서 접두가 붙은 비밀 키를 빌드 환경에 두면 노출로 판정해요', () => {
    expect(judge(item('payment'), { placement: 'build', prefixed: true })).toBe('leak');
  });

  it('접두가 없는 DB 비밀번호는 빌드 환경에 있어도 번들에 들지 않아요', () => {
    const choice: Choice = { placement: 'build', prefixed: false };
    expect(judge(item('db'), choice)).toBe('safe');
    expect(review('vite', { ...DEFAULT_CHOICES, db: choice }).bundleLines.join('\n')).not.toContain('DB_PASSWORD');
  });

  it('브라우저가 읽어야 하는 공개 키에서 접두를 빼면 읽을 수 없어요', () => {
    expect(judge(item('map'), { placement: 'build', prefixed: false })).toBe('missing');
    expect(judge(item('map'), { placement: 'server', prefixed: true })).toBe('missing');
  });

  it('접두가 붙은 비밀 키를 서버에 두면 지금은 안전하지만 함정으로 표시해요', () => {
    expect(judge(item('payment'), { placement: 'server', prefixed: true })).toBe('trap');
  });

  it('브라우저에 가도 되는 값이 번들에 있으면 공개 값으로 판정해요', () => {
    expect(judge(item('api'), { placement: 'build', prefixed: true })).toBe('public');
  });

  it('잘못 만든 예에서 노출 판정은 비밀 세 개만큼 세요', () => {
    expect(review('vite', preset('mistake').choices).leaks).toBe(3);
  });
});

describe('예시', () => {
  it('권장 예시는 노출 판정이 없고, 번들에는 공개 값만 들어가요', () => {
    const r = review(preset('recommended').tool, preset('recommended').choices);
    expect(r.leaks).toBe(0);
    expect(r.bundleLines).toHaveLength(2);
    expect(r.bundleLines.join('\n')).not.toMatch(/SECRET|PASSWORD|SIGNING/);
  });

  it('잘못 만든 예는 비밀 값 세 개가 번들에 들어가요', () => {
    const r = review(preset('mistake').tool, preset('mistake').choices);
    expect(r.leaks).toBe(3);
    expect(r.bundleLines.join('\n')).toContain('VITE_PAYMENT_SECRET_KEY = "EXAMPLE_PAYMENT_0002"');
  });

  it('접두를 빼먹은 예시는 노출 없이 누락으로 판정해요', () => {
    const r = review(preset('no-prefix').tool, preset('no-prefix').choices);
    expect(r.leaks).toBe(0);
    expect(r.rows.find((x) => x.item.id === 'map')?.verdict).toBe('missing');
  });

  it('노출 대응 순서는 폐기 · 교체를 가장 먼저 둬요', () => {
    expect(LEAK_STEPS[0]).toMatch(/폐기|교체/);
    expect(LEAK_STEPS[LEAK_STEPS.length - 1]).toMatch(/이력/);
  });
});

describe('글 메타', () => {
  it('모듈 id 와 순서가 등록돼 있어요', () => {
    expect(moduleById('secrets-config')?.order).toBe(51);
  });
});
