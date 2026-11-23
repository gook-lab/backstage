/** 길이를 세는 단위. 같은 "6자"도 단위에 따라 다른 값이 나와요 */
export type Unit = 'utf16' | 'codepoint' | 'utf8';

/** 서버가 확정하는 규칙. 화면은 이 규칙을 얼마나 옮겼는지에 따라 판정이 달라요 */
export interface Rules {
  readonly maxLength: number;
  readonly unit: Unit;
  /** 저장 전 NFC 로 정규화해요 */
  readonly normalize: boolean;
  /** 저장 전 앞뒤 공백을 떼요 */
  readonly trim: boolean;
}

/**
 * browser: 브라우저 기본 (maxlength 속성 = UTF-16 코드 유닛, 정규화 · 트림 없음).
 * spec: 서버와 같은 규칙을 화면에도 적용.
 */
export type ClientMode = 'browser' | 'spec';

export const UNITS: readonly Unit[] = ['utf16', 'codepoint', 'utf8'];

export const UNIT_LABEL: Record<Unit, string> = {
  utf16: 'UTF-16 코드 유닛',
  codepoint: '코드 포인트',
  utf8: 'UTF-8 바이트',
};

export const DEFAULT_RULES: Rules = { maxLength: 6, unit: 'codepoint', normalize: true, trim: true };
export const DEFAULT_CLIENT: ClientMode = 'browser';

export interface Measure {
  readonly utf16: number;
  readonly codepoint: number;
  readonly utf8: number;
}

/** 세 단위로 같은 문자열을 잰다. UTF-8 은 코드 포인트마다 1~4바이트로 세요 (RFC 3629) */
export function measure(text: string): Measure {
  let codepoint = 0;
  let utf8 = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    codepoint += 1;
    utf8 += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return { utf16: text.length, codepoint, utf8 };
}

/** 정규화를 먼저 하고, 그다음 공백을 뗀다 */
export function prepare(text: string, rules: Pick<Rules, 'normalize' | 'trim'>): string {
  const normalized = rules.normalize ? text.normalize('NFC') : text;
  return rules.trim ? normalized.trim() : normalized;
}

export interface Judgement {
  /** 판정이 세어 본 값. 서버는 정규화 · 트림 뒤 값이고, 브라우저 기본은 입력 그대로예요 */
  readonly stored: string;
  readonly unit: Unit;
  readonly length: number;
  readonly ok: boolean;
}

export function judgeServer(text: string, rules: Rules): Judgement {
  const stored = prepare(text, rules);
  const length = measure(stored)[rules.unit];
  return { stored, unit: rules.unit, length, ok: length <= rules.maxLength };
}

export function judgeClient(text: string, rules: Rules, mode: ClientMode): Judgement {
  if (mode === 'spec') return judgeServer(text, rules);
  const length = measure(text).utf16;
  return { stored: text, unit: 'utf16', length, ok: length <= rules.maxLength };
}

export type Relation = 'agree-pass' | 'agree-fail' | 'client-stricter' | 'server-stricter';

export function relate(client: Judgement, server: Judgement): Relation {
  if (client.ok === server.ok) return client.ok ? 'agree-pass' : 'agree-fail';
  return client.ok ? 'server-stricter' : 'client-stricter';
}

export const RELATION_TEXT: Record<Relation, { tone: 'success' | 'warning'; title: string; body: string }> = {
  'agree-pass': {
    tone: 'success',
    title: '둘 다 통과해요',
    body: '화면과 서버가 같은 규칙으로 세어요. 그래도 저장 확정은 서버 응답으로 받아요.',
  },
  'agree-fail': {
    tone: 'warning',
    title: '둘 다 막아요',
    body: '화면이 먼저 알려 주고, 서버도 같은 이유로 거절해요.',
  },
  'client-stricter': {
    tone: 'warning',
    title: '화면은 막지만 서버는 받아요',
    body: '화면이 세는 방식이 서버보다 엄격해요. 서버가 받을 입력을 화면이 먼저 막고 있어요.',
  },
  'server-stricter': {
    tone: 'warning',
    title: '화면은 통과하지만 서버는 거절해요',
    body: '화면이 놓친 규칙을 서버가 422로 돌려줘요. 화면에서도 같은 규칙을 맞춰야 해요.',
  },
};

export interface Problem {
  readonly pointer: string;
  readonly detail: string;
}

export interface Reply {
  readonly status: 201 | 409 | 422;
  readonly problems: readonly Problem[];
}

/** 형식 검사가 먼저예요. 형식이 맞아야 중복 같은 상태 검사까지 가요 */
export function reply(text: string, rules: Rules, taken: boolean): Reply {
  const server = judgeServer(text, rules);
  if (!server.ok) {
    return {
      status: 422,
      problems: [
        {
          pointer: '/nickname',
          detail: `${UNIT_LABEL[rules.unit]} 기준 ${server.length}로 세어져요. 최대 ${rules.maxLength} 이하여야 해요.`,
        },
      ],
    };
  }
  if (taken) {
    return { status: 409, problems: [{ pointer: '/nickname', detail: '이미 쓰는 닉네임이에요.' }] };
  }
  return { status: 201, problems: [] };
}

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export const PRESETS: readonly Preset[] = [
  { id: 'name', label: '한글 이름', text: '홍길동' },
  { id: 'thumb', label: '피부색 이모지 (엄지 척 + 수정자)', text: '\u{1F44D}\u{1F3FD}' },
  { id: 'nfd', label: '결합 문자 (e + 악센트, 분해형)', text: 'é' },
  { id: 'jamo', label: '한글 자모 분리 (분해형)', text: '한' },
  { id: 'family', label: '가족 이모지 (ZWJ로 연결)', text: '\u{1F468}‍\u{1F469}‍\u{1F467}' },
  { id: 'spaces', label: '앞뒤 공백', text: '  kim  ' },
];
