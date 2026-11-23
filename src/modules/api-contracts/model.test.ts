import { checkUser, screenFor, serverBody } from './model';

describe('계약과 같은 응답은 어느 처리 방식에서도 문제가 없어요', () => {
  it('타입 단언만 써도 화면 값이 계약 기준과 같아요', () => {
    const s = screenFor('assert', 'ok');
    expect(s.detect).toBe('none');
    expect(s.rows.find((r) => r.label === '닉네임')?.value).toBe('@danbi');
  });

  it('경계 파싱도 같은 칸을 같은 값으로 그려요', () => {
    const s = screenFor('parse', 'ok');
    expect(s.detect).toBe('none');
    expect(s.issues).toHaveLength(0);
    expect(s.rows.find((r) => r.label === '권한')?.value).toBe('일반 회원');
  });

  it('추가된 필드는 어떤 방식에서도 문제로 잡히지 않아요', () => {
    expect(screenFor('assert', 'extra').detect).toBe('none');
    expect(screenFor('parse', 'extra').detect).toBe('none');
    expect(screenFor('parse', 'extra').issues).toHaveLength(0);
  });
});

describe('타입 단언만 쓰면 이름 변경은 화면 깊은 곳에서 터져요', () => {
  it('name 이 없는 응답은 trim 에서 예외가 나고 화면이 깨져요', () => {
    const s = screenFor('assert', 'rename');
    expect(s.detect).toBe('deep');
    expect(s.rows).toHaveLength(0);
    expect(s.crash).toContain('trim');
  });

  it('경계 파싱은 같은 응답을 화면 진입 전에 name 칸 위반으로 멈춰요', () => {
    const s = screenFor('parse', 'rename');
    expect(s.detect).toBe('boundary');
    expect(s.issues).toEqual([{ path: 'name', message: '칸이 없어요. 값이 없는 것과 null 은 달라요' }]);
    expect(s.rows).toHaveLength(0);
  });
});

describe('타입 단언만 쓰면 틀린 값이 에러 없이 보여요', () => {
  it('번호가 문자열로 와도 다음 번호가 421 로 보이고 에러는 없어요', () => {
    const s = screenFor('assert', 'type');
    expect(s.detect).toBe('silent');
    expect(s.rows.find((r) => r.label === '다음 번호')?.value).toBe('421');
    expect(s.crash).toBeNull();
  });

  it('nickname 키가 없으면 닉네임이 @undefined 로 보여요', () => {
    const s = screenFor('assert', 'missing');
    expect(s.detect).toBe('silent');
    expect(s.rows.find((r) => r.label === '닉네임')?.value).toBe('@undefined');
  });

  it('권한 owner 는 라벨 표에 없어서 undefined 가 그대로 보여요', () => {
    const s = screenFor('assert', 'enum');
    expect(s.detect).toBe('silent');
    expect(s.rows.find((r) => r.label === '권한')?.value).toBe('undefined');
  });

  it('아주 큰 번호는 정밀도를 잃은 값이 보이고 에러는 없어요', () => {
    expect(serverBody('big-id')).toContain('9007199254740993');
    const s = screenFor('assert', 'big-id');
    expect(s.detect).toBe('silent');
    expect(s.rows.find((r) => r.label === '번호')?.value).toBe('9007199254740992');
  });
});

describe('null 과 칸 없음은 경계 파싱에서 다르게 다뤄요', () => {
  it('명세가 허용하는 null 은 멈추지 않고 닉네임 없음으로 그려요', () => {
    const s = screenFor('parse', 'null');
    expect(s.detect).toBe('none');
    expect(s.rows.find((r) => r.label === '닉네임')?.value).toBe('닉네임 없음');
  });

  it('키가 없는 응답은 null 이 아니라 칸 위반으로 멈춰요', () => {
    const s = screenFor('parse', 'missing');
    expect(s.detect).toBe('boundary');
    expect(s.issues).toEqual([{ path: 'nickname', message: '칸이 없어요. 값이 없는 것과 null 은 달라요' }]);
  });

  it('타입 단언만 쓰면 null 은 맞게 처리돼 문제가 없어요', () => {
    expect(screenFor('assert', 'null').detect).toBe('none');
  });
});

describe('모르는 enum 값은 처리 방식에 따라 멈추거나 대체돼요', () => {
  it('경계 파싱은 owner 를 명세 위반으로 멈춰요', () => {
    const s = screenFor('parse', 'enum');
    expect(s.detect).toBe('boundary');
    expect(s.issues).toEqual([{ path: 'role', message: '명세에 없는 값이에요 (받은 값 "owner")' }]);
  });

  it('파싱 + 대체는 owner 를 일반 회원으로 바꾸고 바꾼 내용을 남겨요', () => {
    const s = screenFor('parse-fallback', 'enum');
    expect(s.detect).toBe('handled');
    expect(s.rows.find((r) => r.label === '권한')?.value).toBe('일반 회원');
    expect(s.notes).toEqual(['모르는 권한 owner 은 일반 회원으로 보여 줘요']);
  });

  it('대체 처리도 다른 칸 위반은 대신 넘기지 않고 멈춰요', () => {
    const s = screenFor('parse-fallback', 'rename');
    expect(s.detect).toBe('boundary');
  });
});

describe('숫자와 문자열 경계', () => {
  it('정수가 아닌 번호 문자열은 정수 위반이에요', () => {
    const r = checkUser({ ...JSON.parse(serverBody('ok')), id: '42' }, false);
    expect(r.user).toBeNull();
    expect(r.issues).toEqual([{ path: 'id', message: '정수여야 해요 (받은 값 "42")' }]);
  });

  it('RFC 3339 가 아닌 날짜 문자열은 형식 위반이에요', () => {
    const r = checkUser({ ...JSON.parse(serverBody('ok')), createdAt: '2026/11/24 09:00' }, false);
    expect(r.issues).toEqual([{ path: 'createdAt', message: 'RFC 3339 날짜 시간 형식이 아니에요' }]);
  });

  it('객체가 아닌 응답은 루트 위반으로 멈춰요', () => {
    const r = checkUser('Bad Request', false);
    expect(r.user).toBeNull();
    expect(r.issues[0].path).toBe('(루트)');
  });
});
