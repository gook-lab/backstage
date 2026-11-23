/**
 * 인가 코드 흐름을 단계별로 흉내 내는 순수 모델.
 * 실제 공급자 응답이나 네트워크 시간은 다루지 않아요. 검사 지점이 있는지 없는지만 봐요.
 * 공개 클라이언트(브라우저 앱)를 가정해요. 클라이언트 비밀값은 없다고 봐요.
 */

/** 흐름 선택. 각 흐름이 어떤 검사를 켜 두었는지를 뜻해요 */
export type Flow = 'pkce' | 'no-pkce' | 'no-state' | 'implicit';

/** 정상 로그인 또는 공격 시나리오 */
export type Attack = 'normal' | 'stolen' | 'forged' | 'url';

export type StepStatus = 'ok' | 'blocked' | 'leak';

export type Outcome = 'login' | 'blocked' | 'compromised';

export interface Step {
  readonly text: string;
  readonly status: StepStatus;
}

export interface LoginResult {
  readonly outcome: Outcome;
  /** 공격이 막혔을 때 막은 검사 이름 */
  readonly blockedBy: string | null;
  readonly steps: readonly Step[];
}

interface FlowSpec {
  readonly label: string;
  /** code 흐름이면 true. implicit 은 URL 에 토큰이 바로 실려요 */
  readonly usesCode: boolean;
  readonly pkce: boolean;
  readonly state: boolean;
}

export const FLOWS: Record<Flow, FlowSpec> = {
  pkce: { label: '인가 코드 + PKCE', usesCode: true, pkce: true, state: true },
  'no-pkce': { label: 'PKCE 없음', usesCode: true, pkce: false, state: true },
  'no-state': { label: 'state 없음', usesCode: true, pkce: true, state: false },
  implicit: { label: 'implicit (토큰 직접 받기)', usesCode: false, pkce: false, state: true },
};

export const FLOW_IDS: readonly Flow[] = ['pkce', 'no-pkce', 'no-state', 'implicit'];

export const ATTACK_LABEL: Record<Attack, string> = {
  normal: '정상 로그인',
  stolen: '가로챈 code 또는 토큰 사용',
  forged: '위조된 콜백',
  url: '토큰이 URL 에 남음',
};

export const ATTACK_IDS: readonly Attack[] = ['normal', 'stolen', 'forged', 'url'];

const PASS: StepStatus = 'ok';
const BLOCK: StepStatus = 'blocked';
const LEAK: StepStatus = 'leak';

/** 흐름과 시나리오를 받아 단계별 결과를 돌려줘요 */
export function simulateLogin(flow: Flow, attack: Attack): LoginResult {
  const spec = FLOWS[flow];
  const steps: Step[] = [];

  if (spec.usesCode) {
    steps.push({
      text: spec.pkce
        ? '앱이 code_verifier를 만들고, 그 SHA-256 해시를 code_challenge로 인가 요청에 실어요.'
        : '인가 요청에 code_challenge가 없어요. 토큰 교환 때 code를 낸 주인임을 증명할 값이 없어요.',
      status: spec.pkce ? PASS : LEAK,
    });
  }

  if (spec.state) {
    steps.push({ text: '앱이 state를 만들어 브라우저에 보관하고 인가 요청에 실어요.', status: PASS });
  } else {
    steps.push({ text: '인가 요청에 state가 없어요. 콜백이 내가 시작한 요청인지 확인할 값이 없어요.', status: LEAK });
  }

  if (!spec.usesCode) {
    return implicitResult(spec, attack, steps);
  }

  if (attack === 'forged') {
    return forgedCode(spec, steps);
  }

  steps.push({ text: '공급자가 로그인과 동의를 받고, 콜백 URL에 code와 state를 실어 돌려보내요.', status: PASS });

  if (attack === 'url') {
    steps.push({
      text: 'code가 브라우저 기록과 리퍼러에 남아요. code는 한 번만 쓸 수 있고 짧게 살아요(RFC 6749 권장 최대 10분).',
      status: LEAK,
    });
  }

  if (attack === 'stolen' || attack === 'url') {
    steps.push({ text: '공격자가 가로챈 code로 토큰 엔드포인트에 교환을 요청해요.', status: LEAK });
    if (spec.pkce) {
      steps.push({
        text: '토큰 엔드포인트가 code_verifier가 없는 요청을 거절해요. code_challenge와 맞는 값을 공격자는 모르기 때문이에요.',
        status: BLOCK,
      });
      return { outcome: 'blocked', blockedBy: 'PKCE code_verifier 검사', steps };
    }
    steps.push({ text: 'PKCE가 없어서 공격자가 토큰을 받아요. 가로챈 code만으로 교환이 끝나요.', status: LEAK });
    return { outcome: 'compromised', blockedBy: null, steps };
  }

  steps.push({
    text: '앱이 code를 토큰 엔드포인트에 보내고, 토큰을 받아요.',
    status: PASS,
  });
  return { outcome: 'login', blockedBy: null, steps };
}

function forgedCode(spec: FlowSpec, steps: Step[]): LoginResult {
  steps.push({
    text: '공격자가 자기 계정으로 시작한 인가 응답을 피해자 브라우저의 콜백 주소로 보내요.',
    status: LEAK,
  });

  if (spec.state) {
    steps.push({
      text: '앱이 콜백의 state를 브라우저에 보관한 값과 비교해요. 피해자 브라우저에는 공격자가 만든 state가 없어 맞지 않아요.',
      status: BLOCK,
    });
    return { outcome: 'blocked', blockedBy: 'state 검사', steps };
  }

  steps.push({
    text: '앱이 state 없이 code를 받아 토큰 교환을 요청해요.',
    status: LEAK,
  });

  if (spec.pkce) {
    steps.push({
      text: '토큰 엔드포인트는 공격자가 만든 code_challenge와 피해자 브라우저의 code_verifier가 맞지 않아 거절해요.',
      status: BLOCK,
    });
    return { outcome: 'blocked', blockedBy: 'PKCE code_verifier 검사', steps };
  }

  steps.push({
    text: '검사가 하나도 없어서 피해자 브라우저가 공격자 계정에 로그인돼요. 피해자가 입력한 정보가 공격자 계정에 쌓일 수 있어요.',
    status: LEAK,
  });
  return { outcome: 'compromised', blockedBy: null, steps };
}

function implicitResult(spec: FlowSpec, attack: Attack, steps: Step[]): LoginResult {
  if (attack === 'forged') {
    steps.push({
      text: '공격자가 만든 access_token이 담긴 콜백을 피해자 브라우저로 보내요.',
      status: LEAK,
    });
    steps.push({
      text: '앱이 콜백 fragment의 state를 비교해요. 피해자 브라우저에 보관된 값과 맞지 않아 거부해요.',
      status: spec.state ? BLOCK : LEAK,
    });
    return spec.state
      ? { outcome: 'blocked', blockedBy: 'state 검사', steps }
      : { outcome: 'compromised', blockedBy: null, steps };
  }

  steps.push({
    text: '공급자가 콜백 URL의 fragment(#)에 access_token을 실어 돌려보내요. 토큰이 토큰 엔드포인트를 거치지 않아요.',
    status: LEAK,
  });

  if (attack === 'url') {
    steps.push({
      text: '토큰이 URL에 그대로 남아 브라우저 기록과 리퍼러, 로그로 새기 쉬워요. 값을 가진 사람은 누구든 API를 불러요.',
      status: LEAK,
    });
    return { outcome: 'compromised', blockedBy: null, steps };
  }

  if (attack === 'stolen') {
    steps.push({
      text: '공격자가 가로챈 access_token으로 API를 불러요. 토큰을 교환할 단계가 없어서 막을 곳이 없어요.',
      status: LEAK,
    });
    return { outcome: 'compromised', blockedBy: null, steps };
  }

  steps.push({ text: '앱이 fragment에서 토큰을 꺼내 API를 불러요.', status: PASS });
  return { outcome: 'login', blockedBy: null, steps };
}
