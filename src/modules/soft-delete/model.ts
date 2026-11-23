/** hard: 행을 지운다 · soft: deleted_at 만 채운다 · soft-partial: soft + 살아 있는 행만 보는 부분 유일 인덱스 · soft-purge: soft-partial + 기간 뒤 영구 삭제 */
export type Method = 'hard' | 'soft' | 'soft-partial' | 'soft-purge';

export type Scenario = 'restore' | 'after-window' | 'rejoin' | 'missing-filter' | 'commented-delete' | 'repeat-delete';

/** table: 조회가 테이블을 직접 읽는다 · view: 살아 있는 행만 보이는 뷰를 거친다 */
export type Guard = 'table' | 'view';

/** 댓글 테이블의 post_id 외래 키에 건 ON DELETE 동작 */
export type Cascade = 'cascade' | 'restrict' | 'set-null';

export interface Answers {
  readonly method: Method;
  readonly scenario: Scenario;
  readonly guard: Guard;
  readonly cascade: Cascade;
}

export const DEFAULT_ANSWERS: Answers = {
  method: 'soft',
  scenario: 'restore',
  guard: 'table',
  cascade: 'cascade',
};

/** 복구 기간. 예시 숫자예요. 실제 기간은 서비스 정책과 법에 따라 정해요 */
export const RESTORE_DAYS = 30;

/** ok: 기대한 결과 · fail: 요청이 실패함 · leak: 지운 데이터가 남거나 보임 */
export type Verdict = 'ok' | 'fail' | 'leak';

export interface Outcome {
  readonly verdict: Verdict;
  readonly status: number;
  readonly headline: string;
  readonly reason: string;
  /** 결과와 별개로 같이 봐야 할 주의점 */
  readonly warn?: string;
}

export const METHOD_LABEL: Record<Method, string> = {
  hard: '하드 삭제 — 행을 지워요',
  soft: '소프트 삭제 — deleted_at 만 채워요',
  'soft-partial': '소프트 + 부분 유일 인덱스',
  'soft-purge': '소프트 + 기간 뒤 영구 삭제',
};

export const SCENARIO_LABEL: Record<Scenario, string> = {
  restore: '복구 요청 — 기간 안에 휴지통에서 복구',
  'after-window': '복구 요청 — 기간이 지난 뒤',
  rejoin: '같은 이메일 재가입 — 탈퇴한 회원과 같은 이메일',
  'missing-filter': '조회 조건 누락 — 목록 쿼리에서 deleted_at 조건을 빠뜨림',
  'commented-delete': '댓글이 달린 글 삭제',
  'repeat-delete': '같은 글에 DELETE 를 두 번 보냄',
};

export const GUARD_LABEL: Record<Guard, string> = {
  table: '테이블 직접 조회',
  view: '살아 있는 행만 보이는 뷰',
};

export const CASCADE_LABEL: Record<Cascade, string> = {
  cascade: 'ON DELETE CASCADE — 댓글도 함께 삭제',
  restrict: 'ON DELETE RESTRICT — 댓글이 있으면 거절',
  'set-null': 'ON DELETE SET NULL — 댓글의 post_id 를 비움',
};

const isSoft = (m: Method) => m !== 'hard';
const isPartial = (m: Method) => m === 'soft-partial' || m === 'soft-purge';

function restore(a: Answers): Outcome {
  if (a.method === 'hard') {
    return {
      verdict: 'fail',
      status: 404,
      headline: '복구할 글이 없어요',
      reason: '하드 삭제는 행을 지워서 되돌릴 행이 없어요.',
    };
  }
  return {
    verdict: 'ok',
    status: 200,
    headline: '글을 복구했어요',
    reason: 'deleted_at 을 비우면 같은 행이 다시 살아나요. 복구도 변경이므로 이력에 남겨요.',
  };
}

function afterWindow(a: Answers): Outcome {
  if (a.method === 'hard') {
    return {
      verdict: 'fail',
      status: 404,
      headline: '복구할 글이 없어요',
      reason: '하드 삭제는 기간과 상관없이 행이 없어요.',
    };
  }
  if (a.method === 'soft-purge') {
    return {
      verdict: 'fail',
      status: 404,
      headline: `복구 기간(${RESTORE_DAYS}일)이 끝났어요`,
      reason: '배치가 기간이 지난 행을 실제로 지워서 복구할 행이 없어요.',
    };
  }
  return {
    verdict: 'leak',
    status: 200,
    headline: '기간이 지난 글도 복구돼요',
    reason: '기간이 지나도 행이 남아 있어요. 기간이 지난 행을 지우는 절차가 없어서예요.',
    warn: '지운 데이터가 계속 쌓여요. 개인정보가 든 행이라면 보존 기간 정책에 어긋날 수 있어요.',
  };
}

function rejoin(a: Answers): Outcome {
  if (a.method === 'hard') {
    return {
      verdict: 'ok',
      status: 201,
      headline: '새 회원으로 가입했어요',
      reason: '탈퇴한 회원의 행이 없어서 이메일 유일 제약에 걸리지 않아요.',
    };
  }
  if (!isPartial(a.method)) {
    return {
      verdict: 'fail',
      status: 409,
      headline: '이 이메일은 쓸 수 없어요',
      reason: 'UNIQUE(email) 은 deleted_at 과 상관없이 옛 행을 세요. 탈퇴한 행이 아직 남아 있어서예요.',
    };
  }
  return {
    verdict: 'ok',
    status: 201,
    headline: '새 회원으로 가입했어요',
    reason: 'WHERE deleted_at IS NULL 조건으로 살아 있는 행끼리만 유일성을 확인해요.',
    warn:
      a.method === 'soft-purge'
        ? `옛 행은 복구 기간(${RESTORE_DAYS}일) 동안 남아요. 그 사이 탈퇴 회원 복구는 이메일 충돌을 따로 처리해야 해요.`
        : '옛 행이 계속 남아요. 탈퇴 회원을 복구하면 같은 이메일이 두 행에 걸려 충돌이 나요.',
  };
}

function missingFilter(a: Answers): Outcome {
  if (a.method === 'hard') {
    return {
      verdict: 'ok',
      status: 200,
      headline: '목록에 지운 글이 없어요',
      reason: '행이 없으니 조건을 빠뜨려도 지운 글이 나오지 않아요.',
    };
  }
  if (a.guard === 'view') {
    return {
      verdict: 'ok',
      status: 200,
      headline: '목록에 지운 글이 없어요',
      reason: '뷰가 살아 있는 행만 보여 줘서, 쿼리마다 조건을 다시 쓰지 않아도 돼요.',
    };
  }
  return {
    verdict: 'leak',
    status: 200,
    headline: '지운 글이 목록에 보여요',
    reason:
      '쿼리가 deleted_at 행을 그대로 읽어요. 부분 인덱스는 조건을 강요하지 않고, 쿼리 조건이 술어를 함의할 때만 쓰여요.',
  };
}

function commentedDelete(a: Answers): Outcome {
  if (isSoft(a.method)) {
    return {
      verdict: 'ok',
      status: 204,
      headline: '글은 deleted_at 만 채워졌어요',
      reason: '외래 키의 ON DELETE 동작은 실제 DELETE 가 행을 지울 때만 실행돼요. 댓글은 그대로 남아요.',
      warn: '댓글 목록에서 부모 글의 deleted_at 을 확인하지 않으면 지운 글의 댓글이 보여요.',
    };
  }
  if (a.cascade === 'restrict') {
    return {
      verdict: 'fail',
      status: 409,
      headline: '댓글이 있어서 지울 수 없어요',
      reason: 'RESTRICT 는 참조하는 행이 있으면 삭제를 막아요.',
    };
  }
  if (a.cascade === 'set-null') {
    return {
      verdict: 'ok',
      status: 204,
      headline: '글은 지워지고 댓글은 남았어요',
      reason: '댓글의 post_id 가 NULL 이 돼요.',
      warn: '고아 댓글이 남아요. 화면에서 숨기지 않으면 어느 글에도 속하지 않는 댓글이 보여요.',
    };
  }
  return {
    verdict: 'ok',
    status: 204,
    headline: '글과 댓글이 함께 지워졌어요',
    reason: 'CASCADE 는 참조하는 댓글 행을 함께 삭제해요.',
    warn: '댓글 기록도 사라져요. 이력이나 신고 기록이 필요하면 CASCADE 를 고르지 않아요.',
  };
}

function repeatDelete(a: Answers): Outcome {
  const first = 204;
  const second = 404;
  return {
    verdict: 'ok',
    status: second,
    headline: `첫 요청 ${first} · 두 번째 요청 ${second}`,
    reason: `${isSoft(a.method) ? '첫 요청이 deleted_at 을 채웠고' : '첫 요청이 행을 지웠고'}, 두 번째는 이미 없는 글을 찾아요. 같은 요청을 반복해도 서버 상태는 같아요(RFC 9110 9.2.2). 응답 코드까지 같아야 하는 것은 아니에요.`,
  };
}

export function decide(a: Answers): Outcome {
  switch (a.scenario) {
    case 'restore':
      return restore(a);
    case 'after-window':
      return afterWindow(a);
    case 'rejoin':
      return rejoin(a);
    case 'missing-filter':
      return missingFilter(a);
    case 'commented-delete':
      return commentedDelete(a);
    case 'repeat-delete':
      return repeatDelete(a);
  }
}

/** 이 사건에서 실제로 쓰이는 선택지. 나머지 선택은 결과에 영향이 없어요 */
export function relevantControls(scenario: Scenario): { guard: boolean; cascade: boolean } {
  return {
    guard: scenario === 'missing-filter',
    cascade: scenario === 'commented-delete',
  };
}
