import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, type Params, prefixesOf, simulate, type StaleGuard, type Strategy } from './model';

const base: Params = {
  query: DEFAULT_QUERY,
  strategy: 'every',
  windowMs: 300,
  guard: 'none',
  seed: 7,
};

function run(overrides: Partial<Params>) {
  return simulate({ ...base, ...overrides });
}

/** 낡은 응답이 화면을 덮는 시드를 찾아요. 보호 방식 없이 돌렸을 때 틀린 결과가 남는 경우 */
function findRacingSeed(): number {
  for (let seed = 1; seed <= 200; seed++) {
    if (!run({ seed, guard: 'none' }).correct) return seed;
  }
  throw new Error('경쟁 상태를 보여 주는 시드가 없어요');
}

describe('키 입력마다 보내기', () => {
  it('입력한 글자 수만큼 요청이 나가요', () => {
    const r = run({ strategy: 'every' });
    expect(r.sent).toBe(r.typedCount);
    expect(r.typedCount).toBe(Array.from(DEFAULT_QUERY).length);
  });

  it('요청마다 그 시점까지 입력한 검색어를 보내요', () => {
    const r = run({ strategy: 'every' });
    expect(r.requests.map((q) => q.query)).toEqual(prefixesOf(DEFAULT_QUERY));
  });
});

describe('디바운스와 스로틀', () => {
  it('디바운스는 키 입력마다 보내는 방식보다 요청을 적게 보내요', () => {
    const every = run({ strategy: 'every' });
    const debounced = run({ strategy: 'debounce', windowMs: 300 });
    expect(debounced.sent).toBeLessThan(every.sent);
    expect(debounced.sent).toBeGreaterThanOrEqual(1);
  });

  it('간격을 넓힐수록 디바운스가 보내는 요청이 줄거나 같아요', () => {
    const counts = [100, 200, 400, 600].map((windowMs) => run({ strategy: 'debounce', windowMs }).sent);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('스로틀은 간격마다 최대 한 번만 보내요', () => {
    const windowMs = 300;
    const r = run({ strategy: 'throttle', windowMs });
    const sendTimes = r.requests.map((q) => q.sentAt);
    expect(new Set(sendTimes).size).toBe(sendTimes.length);
    for (const at of sendTimes) expect(at % windowMs).toBe(0);
  });

  it('같은 시드에서 전략을 바꿔도 손님의 입력 시각은 같아요', () => {
    const a = run({ strategy: 'every' });
    const b = run({ strategy: 'debounce' });
    expect(b.keys).toEqual(a.keys);
  });
});

describe('낡은 응답 처리', () => {
  it('보호 없이 키마다 보내면 늦게 온 낡은 응답이 화면을 덮을 수 있어요', () => {
    const seed = findRacingSeed();
    const r = run({ seed, strategy: 'every', guard: 'none' });
    expect(r.correct).toBe(false);
    expect(r.staleShown).toBeGreaterThan(0);
    expect(r.shownQuery).not.toBe(r.finalQuery);
  });

  it.each<StaleGuard>(['seq', 'abort'])('%s 를 켜면 같은 시드에서도 마지막 검색어 결과가 남아요', (guard) => {
    const seed = findRacingSeed();
    const r = run({ seed, strategy: 'every', guard });
    expect(r.correct).toBe(true);
    expect(r.staleShown).toBe(0);
    expect(r.shownQuery).toBe(r.finalQuery);
  });

  it('순번 확인은 낡은 응답을 버리고, 취소는 요청을 끊어요', () => {
    const seed = findRacingSeed();
    const seq = run({ seed, strategy: 'every', guard: 'seq' });
    const abort = run({ seed, strategy: 'every', guard: 'abort' });
    expect(seq.requests.some((q) => q.status === 'ignored')).toBe(true);
    expect(seq.cancelled).toBe(0);
    expect(abort.cancelled).toBeGreaterThan(0);
    expect(abort.requests.some((q) => q.status === 'ignored')).toBe(false);
  });

  it('취소해도 보낸 요청 수는 줄지 않아요. 줄이는 것은 디바운스 같은 전송 전략이에요', () => {
    const seed = findRacingSeed();
    const none = run({ seed, strategy: 'every', guard: 'none' });
    const abort = run({ seed, strategy: 'every', guard: 'abort' });
    expect(abort.sent).toBe(none.sent);
  });
});

describe('입력이 없을 때', () => {
  it('빈 검색어면 요청이 없어요', () => {
    const strategies: Strategy[] = ['every', 'debounce', 'throttle'];
    for (const strategy of strategies) {
      const r = run({ query: '', strategy });
      expect(r.sent).toBe(0);
      expect(r.correct).toBe(true);
      expect(r.shownQuery).toBeNull();
    }
  });
});
