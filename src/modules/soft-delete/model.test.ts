import { describe, expect, it } from 'vitest';
import { type Answers, DEFAULT_ANSWERS, type Method, decide, RESTORE_DAYS } from './model';

const run = (patch: Partial<Answers>) => decide({ ...DEFAULT_ANSWERS, ...patch });

describe('복구 요청', () => {
  it('하드 삭제는 되돌릴 행이 없어서 404 를 받아요', () => {
    expect(run({ method: 'hard', scenario: 'restore' })).toMatchObject({ verdict: 'fail', status: 404 });
  });

  it.each<Method>(['soft', 'soft-partial', 'soft-purge'])('%s 는 기간 안에 같은 행을 복구해요', (method) => {
    expect(run({ method, scenario: 'restore' })).toMatchObject({ verdict: 'ok', status: 200 });
  });
});

describe('복구 기간이 지난 뒤', () => {
  it('영구 삭제 배치를 쓰면 복구할 행이 없어요', () => {
    const out = run({ method: 'soft-purge', scenario: 'after-window' });
    expect(out).toMatchObject({ verdict: 'fail', status: 404 });
    expect(out.headline).toContain(`${RESTORE_DAYS}일`);
  });

  it('배치 없이 소프트 삭제만 하면 지운 글이 계속 살아 있어요', () => {
    expect(run({ method: 'soft', scenario: 'after-window' })).toMatchObject({ verdict: 'leak', status: 200 });
    expect(run({ method: 'soft-partial', scenario: 'after-window' })).toMatchObject({ verdict: 'leak' });
  });
});

describe('같은 이메일 재가입', () => {
  it('일반 UNIQUE 로 소프트 삭제하면 탈퇴한 옛 행 때문에 409 가 나요', () => {
    expect(run({ method: 'soft', scenario: 'rejoin' })).toMatchObject({ verdict: 'fail', status: 409 });
  });

  it.each<Method>(['hard', 'soft-partial', 'soft-purge'])('%s 에서는 새 회원으로 가입돼요', (method) => {
    expect(run({ method, scenario: 'rejoin' })).toMatchObject({ verdict: 'ok', status: 201 });
  });

  it('부분 유일 인덱스로 가입해도 옛 행이 남아 있다는 주의를 같이 보여 줘요', () => {
    expect(run({ method: 'soft-partial', scenario: 'rejoin' }).warn).toContain('옛 행');
  });
});

describe('조회 조건 누락', () => {
  it('테이블을 직접 읽는 소프트 삭제는 지운 글을 그대로 보여 줘요', () => {
    expect(run({ method: 'soft', scenario: 'missing-filter', guard: 'table' })).toMatchObject({
      verdict: 'leak',
      headline: '지운 글이 목록에 보여요',
    });
  });

  it('부분 인덱스만 있으면 조건을 빠뜨린 쿼리가 여전히 지운 글을 보여 줘요', () => {
    expect(run({ method: 'soft-partial', scenario: 'missing-filter', guard: 'table' }).verdict).toBe('leak');
  });

  it('뷰를 거치면 조건을 빠뜨려도 지운 글이 나오지 않아요', () => {
    expect(run({ method: 'soft-partial', scenario: 'missing-filter', guard: 'view' })).toMatchObject({
      verdict: 'ok',
      status: 200,
    });
  });
});

describe('댓글이 달린 글 삭제', () => {
  it('하드 삭제에 RESTRICT 를 걸면 댓글이 있는 글은 409 로 막혀요', () => {
    expect(run({ method: 'hard', scenario: 'commented-delete', cascade: 'restrict' })).toMatchObject({
      verdict: 'fail',
      status: 409,
    });
  });

  it('하드 삭제에 CASCADE 를 걸면 댓글도 함께 사라진다고 경고해요', () => {
    const out = run({ method: 'hard', scenario: 'commented-delete', cascade: 'cascade' });
    expect(out).toMatchObject({ verdict: 'ok', status: 204 });
    expect(out.warn).toContain('댓글 기록');
  });

  it('SET NULL 은 고아 댓글이 남는다고 경고해요', () => {
    expect(run({ method: 'hard', scenario: 'commented-delete', cascade: 'set-null' }).warn).toContain('고아 댓글');
  });

  it('소프트 삭제에서는 ON DELETE 가 실행되지 않아 댓글이 그대로 남아요', () => {
    const out = run({ method: 'soft', scenario: 'commented-delete', cascade: 'cascade' });
    expect(out).toMatchObject({ verdict: 'ok', status: 204 });
    expect(out.reason).toContain('실제 DELETE');
  });
});

describe('같은 DELETE 반복', () => {
  it.each<Method>(['hard', 'soft', 'soft-partial', 'soft-purge'])(
    '%s 는 두 번째 응답이 404 여도 상태 효과는 같다고 설명해요',
    (method) => {
      const out = run({ method, scenario: 'repeat-delete' });
      expect(out).toMatchObject({ verdict: 'ok', status: 404 });
      expect(out.headline).toContain('첫 요청 204');
      expect(out.reason).toContain('RFC 9110 9.2.2');
    },
  );
});
