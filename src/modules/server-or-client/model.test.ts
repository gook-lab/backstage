import { describe, expect, it } from 'vitest';
import { type Answers, DEFAULT_ANSWERS, type DataSize, decide, LINK_LABEL, PRESETS, RULES } from './model';

const DATA_SIZES: readonly DataSize[] = ['small', 'medium', 'large'];

function allAnswers(): Answers[] {
  const flags = [false, true];
  const out: Answers[] = [];
  for (const sensitive of flags)
    for (const shared of flags)
      for (const instant of flags)
        for (const heavy of flags)
          for (const secret of flags)
            for (const offline of flags)
              for (const dataSize of DATA_SIZES)
                out.push({ sensitive, shared, instant, heavy, secret, offline, dataSize });
  return out;
}

describe('예시 판단', () => {
  it.each(PRESETS.map((p) => [p.label, p] as const))('%s 는 기대한 추천이 나와요', (_, preset) => {
    expect(decide(preset.answers).verdict).toBe(preset.expected);
  });
});

describe('판단 규칙', () => {
  it('돈 · 권한 · 재고 · 공유 · 비밀 규칙이 있으면 클라이언트 단독으로 처리하지 않아요', () => {
    const authority = allAnswers().filter((a) => a.sensitive || a.shared || a.secret);
    expect(authority.length).toBeGreaterThan(0);
    for (const a of authority) {
      expect(decide(a).verdict).not.toBe('client');
    }
  });

  it('비밀 규칙이 있으면 즉각 반응이 필요해도 미리보기를 클라이언트에 맡기지 않아요', () => {
    const verdict = decide({ ...DEFAULT_ANSWERS, secret: true, instant: true }).verdict;
    expect(verdict).toBe('server');
  });

  it('작은 목록에 즉각 반응만 필요하면 클라이언트에서 처리해요', () => {
    expect(decide({ ...DEFAULT_ANSWERS, dataSize: 'small', instant: true }).verdict).toBe('client');
  });

  it('데이터가 커지면 즉각 반응이 필요해도 서버에서 처리해요', () => {
    expect(decide({ ...DEFAULT_ANSWERS, dataSize: 'large', instant: true }).verdict).toBe('server');
  });

  it('기본값은 클라이언트에서 처리해요', () => {
    expect(decide(DEFAULT_ANSWERS).verdict).toBe('client');
  });

  it('추천 이유는 조건에 맞은 규칙과 정확히 같아요', () => {
    for (const a of allAnswers()) {
      const expected = RULES.filter((r) => r.when(a)).map((r) => r.id);
      expect(decide(a).reasons.map((r) => r.id)).toEqual(expected);
    }
  });

  it('규칙에 연결된 모듈은 모두 이름표가 있어요', () => {
    for (const rule of RULES) {
      for (const id of rule.modules) {
        expect(LINK_LABEL[id], `${rule.id} → ${id}`).toBeDefined();
      }
    }
  });
});
