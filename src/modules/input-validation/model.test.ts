import { moduleById } from '..';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIENT,
  DEFAULT_RULES,
  judgeClient,
  judgeServer,
  measure,
  PRESETS,
  prepare,
  type Rules,
  relate,
  reply,
  UNITS,
} from './model';

const NFD_E = 'é';
const FAMILY = PRESETS.find((p) => p.id === 'family')!.text;
const JAMO = PRESETS.find((p) => p.id === 'jamo')!.text;
const THUMB = PRESETS.find((p) => p.id === 'thumb')!.text;
const rules = (patch: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...patch });

describe('길이 단위', () => {
  it('한글 세 글자는 세 단위에서 각각 3 · 3 · 9 로 세요', () => {
    expect(measure('홍길동')).toEqual({ utf16: 3, codepoint: 3, utf8: 9 });
  });

  it('피부색 이모지는 코드 포인트 2개이지만 UTF-16 4 유닛이에요', () => {
    expect(measure(THUMB)).toEqual({ utf16: 4, codepoint: 2, utf8: 8 });
  });

  it('가족 이모지는 사람 눈에 한 글자지만 세 단위가 모두 달라요', () => {
    expect(measure(FAMILY)).toEqual({ utf16: 8, codepoint: 5, utf8: 18 });
  });

  it('결합 문자 e + 악센트는 정규화 전후에 길이가 바뀌어요', () => {
    expect(measure(NFD_E)).toEqual({ utf16: 2, codepoint: 2, utf8: 3 });
    expect(measure(prepare(NFD_E, { normalize: true, trim: false }))).toEqual({ utf16: 1, codepoint: 1, utf8: 2 });
  });
});

describe('정규화와 트림', () => {
  it('분해된 한글 자모는 NFC 로 합쳐져 한 음절이 돼요', () => {
    expect(prepare(JAMO, { normalize: true, trim: false })).toBe('한');
    expect(prepare(JAMO, { normalize: false, trim: false })).toBe(JAMO);
  });

  it('앞뒤 공백을 떼면 저장 값과 길이가 줄어요', () => {
    const server = judgeServer('  kim  ', rules({ maxLength: 5, unit: 'codepoint', normalize: false, trim: true }));
    expect(server).toMatchObject({ stored: 'kim', length: 3, ok: true });
  });
});

describe('판정 비교', () => {
  it('기본값은 가족 이모지를 화면에서 막고 서버에서는 받아요', () => {
    const client = judgeClient(FAMILY, DEFAULT_RULES, DEFAULT_CLIENT);
    const server = judgeServer(FAMILY, DEFAULT_RULES);
    expect(client.ok).toBe(false);
    expect(server.ok).toBe(true);
    expect(relate(client, server)).toBe('client-stricter');
  });

  it('공백이 낀 입력은 브라우저 기본 화면에서 막히고 서버에서는 통과해요', () => {
    const r = rules({ maxLength: 5, unit: 'codepoint' });
    expect(relate(judgeClient('  kim  ', r, 'browser'), judgeServer('  kim  ', r))).toBe('client-stricter');
  });

  it('바이트 단위로 세면 한글 이름이 서버에서만 거절돼요', () => {
    const r = rules({ maxLength: 5, unit: 'utf8' });
    const client = judgeClient('홍길동', r, 'browser');
    const server = judgeServer('홍길동', r);
    expect(client.ok).toBe(true);
    expect(server.ok).toBe(false);
    expect(relate(client, server)).toBe('server-stricter');
  });

  it('결합 문자를 정규화하면 서버는 한 글자로 세고, 브라우저 기본은 두 유닛으로 세요', () => {
    const r = rules({ maxLength: 1, unit: 'codepoint', normalize: true, trim: true });
    expect(judgeServer(NFD_E, r)).toMatchObject({ stored: 'é', length: 1, ok: true });
    expect(relate(judgeClient(NFD_E, r, 'browser'), judgeServer(NFD_E, r))).toBe('client-stricter');
  });

  it('정규화를 끄면 서버도 두 코드 포인트로 세서 둘 다 막아요', () => {
    const r = rules({ maxLength: 1, unit: 'codepoint', normalize: false, trim: false });
    expect(relate(judgeClient(NFD_E, r, 'browser'), judgeServer(NFD_E, r))).toBe('agree-fail');
  });

  it('화면이 서버와 같은 규칙을 쓰면 어떤 입력에서도 판정이 어긋나지 않아요', () => {
    for (const preset of PRESETS) {
      for (const unit of UNITS) {
        for (const normalize of [false, true]) {
          for (const trim of [false, true]) {
            for (let maxLength = 1; maxLength <= 20; maxLength += 1) {
              const r = rules({ maxLength, unit, normalize, trim });
              const relation = relate(judgeClient(preset.text, r, 'spec'), judgeServer(preset.text, r));
              expect(relation === 'agree-pass' || relation === 'agree-fail').toBe(true);
            }
          }
        }
      }
    }
  });
});

describe('서버 응답', () => {
  it('형식이 맞고 중복이 없으면 201 을 돌려줘요', () => {
    expect(reply('홍길동', rules({ maxLength: 8 }), false)).toEqual({ status: 201, problems: [] });
  });

  it('길이가 넘으면 422 와 닉네임 칸 경로를 돌려줘요', () => {
    const res = reply('홍길동', rules({ maxLength: 4, unit: 'utf8' }), false);
    expect(res.status).toBe(422);
    expect(res.problems[0]?.pointer).toBe('/nickname');
  });

  it('형식이 맞은 중복 값은 409 를 돌려줘요', () => {
    expect(reply('홍길동', rules({ maxLength: 8 }), true).status).toBe(409);
  });

  it('형식과 중복이 함께면 형식 오류인 422 가 먼저예요', () => {
    expect(reply('홍길동', rules({ maxLength: 4, unit: 'utf8' }), true).status).toBe(422);
  });
});

describe('예시 연결', () => {
  it('시뮬레이터 안내에서 이어 읽을 모듈이 등록돼 있어요', () => {
    expect(moduleById('server-or-client')?.title).toBeDefined();
    expect(moduleById('api-errors')?.title).toBeDefined();
  });
});
