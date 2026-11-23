import { PRESETS, attemptsOf, simulate, type Config } from './model';

const preset = (id: string) => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`preset ${id} not found`);
  return found.config;
};

const base: Config = preset('outbox-basic');

describe('검색 색인 반영 모델', () => {
  it('아웃박스는 발행 지연 뒤 다음 refresh 에 검색 결과가 DB 와 같아져요', () => {
    expect(simulate(base).syncedFrom).toBe(2);
  });

  it('refresh 간격이 길면 쓴 값이 있어도 검색에는 refresh 시각까지 옛 값이 남아요', () => {
    const outcome = simulate({ ...base, mode: 'cdc', delay: 8, refresh: 30 });
    expect(outcome.visible[0].at).toBe(30);
    expect(outcome.syncedFrom).toBe(30);
  });

  it('이중 쓰기에서 색인 쓰기가 실패하고 재시도가 없으면 끝까지 옛 값이 남아요', () => {
    const outcome = simulate(preset('dual-fail-no-retry'));
    expect(outcome.attempts).toEqual([{ at: 0, ok: false }]);
    expect(outcome.syncedFrom).toBeNull();
    expect(outcome.series[outcome.series.length - 1].search).toBe('old');
  });

  it('이중 쓰기 실패라도 재시도가 있으면 RETRY_EVERY 초 뒤에 맞춰요', () => {
    const outcome = simulate(preset('dual-fail-retry'));
    expect(outcome.attempts).toEqual([
      { at: 0, ok: false },
      { at: 5, ok: true },
    ]);
    expect(outcome.syncedFrom).toBe(5);
  });

  it('재색인이 끝나 별칭을 바꾸면 실패로 남은 옛 값이 정리돼요', () => {
    const outcome = simulate(preset('dual-fail-reindex'));
    expect(outcome.syncedFrom).toBe(90);
    expect(outcome.visible.at(-1)?.kind).toBe('reindex');
  });

  it('상품 삭제는 refresh 뒤 검색에서 사라져요', () => {
    const outcome = simulate(preset('outbox-delete'));
    const before = outcome.series.find((p) => p.t === 1);
    const after = outcome.series.find((p) => p.t === 2);
    expect(before).toMatchObject({ db: 'gone', search: 'old', same: false });
    expect(after).toMatchObject({ db: 'gone', search: 'gone', same: true });
  });

  it('재시도 횟수만큼 시도 시각이 5초 간격으로 늘어나요', () => {
    const attempts = attemptsOf({ ...base, mode: 'outbox', delay: 3, failCount: 2, retry: true });
    expect(attempts).toEqual([
      { at: 3, ok: false },
      { at: 8, ok: false },
      { at: 13, ok: true },
    ]);
  });
});
