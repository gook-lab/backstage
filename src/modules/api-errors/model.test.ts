import { parseReply, screenFor, serverReply } from './model';

describe('같은 입력 오류를 세 방식으로 받을 때', () => {
  it('problem+json 은 칸 3곳에 각각 오류를 붙여요', () => {
    const s = screenFor('problem-json', 'fields');
    expect(s.fieldErrors.map((e) => e.field)).toEqual(['email', 'password', 'nickname']);
    expect(s.banner).toBe('입력값을 확인해 주세요');
  });

  it('400 텍스트 한 줄은 칸 오류가 0개이고 일반 메시지만 남아요', () => {
    const s = screenFor('text-400', 'fields');
    expect(s.fieldErrors).toHaveLength(0);
    expect(s.banner).toBe('입력을 확인해 주세요');
    expect(serverReply('text-400', 'fields').body).toBe('Bad Request');
  });

  it('200 에러 문자열은 상태 코드가 성공이라 칸 오류가 0개예요', () => {
    const s = screenFor('string-200', 'fields');
    expect(serverReply('string-200', 'fields').status).toBe(200);
    expect(s.fieldErrors).toHaveLength(0);
    expect(s.banner).toBe('입력값을 확인해 주세요');
  });
});

describe('이메일 중복 — type 으로 칸을 특정해요', () => {
  it('problem+json 은 pointer 로 이메일 칸 하나에만 오류를 붙이고 상단 문구는 없어요', () => {
    const s = screenFor('problem-json', 'duplicate');
    expect(s.fieldErrors).toEqual([{ field: 'email', message: '이 이메일은 이미 사용 중이에요' }]);
    expect(s.banner).toBeNull();
  });

  it('텍스트 방식은 409 를 일반 문구로만 보여 줘요', () => {
    const s = screenFor('text-400', 'duplicate');
    expect(s.fieldErrors).toHaveLength(0);
    expect(s.banner).toBe('요청이 현재 상태와 충돌해요');
  });
});

describe('재시도 신호 — 상태 코드와 Retry-After 로 판단해요', () => {
  it('503 과 Retry-After 가 있으면 텍스트와 problem+json 모두 재시도 버튼을 보여요', () => {
    expect(screenFor('text-400', 'overload').retryButton).toBe(true);
    expect(screenFor('problem-json', 'overload').retryButton).toBe(true);
  });

  it('200 으로 보내면 재시도 신호가 사라져서 버튼이 없어요', () => {
    const s = screenFor('string-200', 'overload');
    expect(serverReply('string-200', 'overload').retryAfterSec).toBeNull();
    expect(s.retryButton).toBe(false);
    expect(s.banner).toBe('잠시 후 다시 시도해 주세요');
  });

  it('500 은 자동 재시도 버튼을 두지 않아요', () => {
    expect(screenFor('problem-json', 'internal').retryButton).toBe(false);
  });
});

describe('내부 정보와 문의 번호', () => {
  it('problem+json 500 은 일반 문구와 요청 번호만 보여 주고 원인 문자열은 빼요', () => {
    const reply = serverReply('problem-json', 'internal');
    const s = screenFor('problem-json', 'internal');
    expect(s.banner).toBe('문제가 생겼어요');
    expect(s.requestId).toBe('req-7f3a2c');
    expect(JSON.stringify(reply)).not.toMatch(/stack|SELECT|Exception/i);
  });

  it('텍스트와 200 방식은 요청 번호가 없어요', () => {
    expect(screenFor('text-400', 'internal').requestId).toBeNull();
    expect(screenFor('string-200', 'internal').requestId).toBeNull();
  });
});

describe('알 수 없는 type — 일반 메시지로 물러나요', () => {
  it('처음 보는 type 은 상태 코드 기준 일반 문구를 써요', () => {
    const s = parseReply({
      status: 409,
      retryAfterSec: null,
      body: { type: 'https://example.com/problems/new-thing', title: '새 오류', status: 409 },
    });
    expect(s.fieldErrors).toHaveLength(0);
    expect(s.banner).toBe('요청이 현재 상태와 충돌해요');
  });
});
