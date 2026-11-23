import { moduleById } from '..';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, inspect, LIMITS, PRESETS, SAMPLES, type UploadConfig, type UploadSample } from './model';

const sample = (id: string): UploadSample => {
  const found = SAMPLES.find((s) => s.id === id);
  if (!found) throw new Error(`예시 없음: ${id}`);
  return found;
};

const preset = (id: string): UploadConfig => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`조합 없음: ${id}`);
  return found.config;
};

const ALL_OFF: UploadConfig = {
  extension: false,
  contentType: false,
  magic: false,
  size: false,
  reencode: false,
  separateHost: false,
  headers: false,
};

const riskIds = (s: UploadSample, c: UploadConfig) => inspect(s, c).risks.map((r) => r.id);

describe('업로드 검사 단계', () => {
  it('정상 PNG 는 모든 단계를 통과하고 낮은 위험만 남겨요', () => {
    const verdict = inspect(sample('png-ok'), preset('recommended'));
    expect(verdict.accepted).toBe(true);
    expect(verdict.stages.every((s) => s.status === 'passed')).toBe(true);
    expect(verdict.risks.map((r) => r.severity)).toEqual(['low']);
  });

  it('확장자만 png 인 HTML 은 확장자와 Content-Type 만 보면 통과해요', () => {
    const verdict = inspect(sample('html-as-png'), DEFAULT_CONFIG);
    expect(verdict.accepted).toBe(true);
    expect(verdict.stages.find((s) => s.id === 'magic')?.status).toBe('skipped');
    expect(riskIds(sample('html-as-png'), DEFAULT_CONFIG)).toContain('script-app');
  });

  it('첫 바이트 검사를 켜면 같은 HTML 이 매직 넘버에서 거절돼요', () => {
    const verdict = inspect(sample('html-as-png'), { ...DEFAULT_CONFIG, magic: true });
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectedBy).toBe('magic');
    expect(verdict.risks).toEqual([]);
  });

  it('SVG 는 확장자 허용 목록에서 먼저 거절되고, 확장자 검사를 끄면 매직 넘버에서 거절돼요', () => {
    expect(inspect(sample('svg-script'), preset('fe-only')).rejectedBy).toBe('extension');
    const withoutNames = inspect(sample('svg-script'), { ...ALL_OFF, magic: true });
    expect(withoutNames.rejectedBy).toBe('magic');
  });

  it('50000×50000 이미지는 크기 검사를 켜면 거절되고, 끄면 디코딩 메모리 위험이 남아요', () => {
    expect(LIMITS.maxSide).toBeLessThan(50_000);
    expect(inspect(sample('huge-png'), { ...ALL_OFF, extension: true, size: true }).rejectedBy).toBe('size');

    const open = inspect(sample('huge-png'), preset('fe-only'));
    expect(open.accepted).toBe(true);
    const bomb = open.risks.find((r) => r.id === 'bomb');
    expect(bomb?.severity).toBe('high');
    expect(bomb?.text).toContain('10.0GB');
  });

  it('재인코딩은 디코딩 한도를 대신하지 못해요. 한도가 꺼져 있으면 디코딩 위험이 그대로 남아요', () => {
    const verdict = inspect(sample('huge-png'), { ...ALL_OFF, extension: true, reencode: true });
    expect(verdict.accepted).toBe(true);
    expect(verdict.risks.some((r) => r.id === 'bomb')).toBe(true);
  });

  it('위치 EXIF 가 있는 JPEG 는 재인코딩을 끄면 위치 위험이 남고, 켜면 사라져요', () => {
    expect(riskIds(sample('jpeg-gps'), preset('fe-only'))).toContain('location');
    expect(riskIds(sample('jpeg-gps'), preset('recommended'))).not.toContain('location');
  });

  it('HTML 은 재인코딩에서 디코딩되지 않아 거절돼요', () => {
    const verdict = inspect(sample('html-as-png'), { ...ALL_OFF, extension: true, reencode: true });
    expect(verdict.rejectedBy).toBe('reencode');
  });
});

describe('매직 넘버의 한계', () => {
  it('PNG 머리를 가진 파일은 뒤에 붙은 HTML 을 보지 않고 매직 넘버를 통과해요', () => {
    const verdict = inspect(sample('png-html'), { ...ALL_OFF, magic: true });
    expect(verdict.accepted).toBe(true);
    const magic = verdict.stages.find((s) => s.id === 'magic');
    expect(magic?.reason).toContain('뒤의 내용은 이 검사가 보지 않아요');
    expect(verdict.risks.map((r) => r.id)).toContain('script-app');
  });

  it('같은 파일도 재인코딩을 켜면 스크립트 바이트가 사라져요', () => {
    expect(riskIds(sample('png-html'), { ...ALL_OFF, magic: true, reencode: true })).not.toContain('script-app');
  });
});

describe('서빙 설정이 남기는 위험', () => {
  it('다른 도메인에서 서빙하면 스크립트 위험이 앱 도메인 위험에서 중간 위험으로 낮아져요', () => {
    const risks = inspect(sample('html-as-png'), { ...DEFAULT_CONFIG, separateHost: true }).risks;
    expect(risks.find((r) => r.id === 'script-app')).toBeUndefined();
    expect(risks.find((r) => r.id === 'script-other')?.severity).toBe('medium');
  });

  it('nosniff 를 끈 채 스크립트 파일을 받으면 타입 추측 위험을 알려 줘요', () => {
    expect(riskIds(sample('html-as-png'), DEFAULT_CONFIG)).toContain('sniff');
    expect(riskIds(sample('html-as-png'), { ...DEFAULT_CONFIG, headers: true })).not.toContain('sniff');
  });
});

describe('권장 조합', () => {
  it('모든 예시 파일이 거절되거나, 낮은 위험만 남기고 통과해요', () => {
    const verdicts = SAMPLES.map((s) => inspect(s, preset('recommended')));
    expect(verdicts.every((v) => v.accepted || v.rejectedBy !== undefined)).toBe(true);
    expect(verdicts.filter((v) => v.accepted).flatMap((v) => v.risks.filter((r) => r.severity !== 'low'))).toEqual([]);
  });

  it('권장 조합은 예시마다 거절 단계가 달라요', () => {
    expect(inspect(sample('html-as-png'), preset('recommended')).rejectedBy).toBe('magic');
    expect(inspect(sample('svg-script'), preset('recommended')).rejectedBy).toBe('extension');
    expect(inspect(sample('huge-png'), preset('recommended')).rejectedBy).toBe('size');
  });
});

describe('시뮬레이터 모듈 등록', () => {
  it('upload-security 모듈은 실전 사례 트랙 69번째 순서로 등록돼요', () => {
    const found = moduleById('upload-security');
    expect(found?.track).toBe('cases');
    expect(found?.order).toBe(69);
  });
});
