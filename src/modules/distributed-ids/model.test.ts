import { compareKeys, generate, naiveNext, type Params } from './model';

const base: Params = { scheme: 'serial', count: 40, rollbackRate: 0, monotonicV7: false, seed: 7 };
const run = (over: Partial<Params>) => generate({ ...base, ...over });

describe('ID 설계 모델', () => {
  it('자동 증가는 1, 2, 3 으로 이어지고 생성 순서와 정렬 순서가 같아요', () => {
    const r = run({});
    expect(r.rows.slice(0, 3).map((x) => x.key)).toEqual(['1', '2', '3']);
    expect(r.sortedMatch).toBe(1);
    expect(r.guessHit).toBe(1);
    expect(r.gaps).toBe(0);
  });

  it('롤백이 있으면 자동 증가에 빈 번호가 생기고, 다음 값 추측이 깨져요', () => {
    const r = run({ rollbackRate: 0.2 });
    expect(r.gaps).toBeGreaterThan(0);
    expect(r.guessHit).toBeLessThan(1);
    expect(r.sortedMatch).toBe(1);
  });

  it('UUID v4 는 정렬 순서가 생성 순서와 무관하고, 삽입이 끝이 아니라 흩어져요', () => {
    const r = run({ scheme: 'uuid-v4' });
    expect(r.sortedMatch).toBeGreaterThan(0.3);
    expect(r.sortedMatch).toBeLessThan(0.7);
    expect(r.appendShare).toBeLessThan(0.2);
    expect(r.guessHit).toBe(0);
  });

  it('UUID v7 은 대부분 생성 순서를 따르지만, 같은 밀리초 안에서는 섞여요', () => {
    const r = run({ scheme: 'uuid-v7' });
    expect(r.sortedMatch).toBeGreaterThan(0.8);
    expect(r.sortedMatch).toBeLessThan(1);
    expect(r.appendShare).toBeGreaterThan(0.8);
  });

  it('UUID v7 에 같은 밀리초 카운터를 쓰면 정렬 순서가 생성 순서와 항상 같아요', () => {
    const r = run({ scheme: 'uuid-v7', monotonicV7: true });
    expect(r.sortedMatch).toBe(1);
    expect(r.appendShare).toBe(1);
  });

  it('64비트 정수는 2의 53제곱을 넘어서 JS Number 로 읽으면 값이 바뀌어요', () => {
    const r = run({ scheme: 'int64' });
    expect(r.precisionLoss).toBeGreaterThan(0);
    expect(run({ scheme: 'serial' }).precisionLoss).toBe(0);
  });

  it('UUID 는 숫자 정밀도 손실을 세지 않아요', () => {
    expect(run({ scheme: 'uuid-v4' }).precisionLoss).toBe(0);
  });

  it('같은 시드는 항상 같은 결과를 만들어요', () => {
    expect(run({ scheme: 'uuid-v7' })).toEqual(run({ scheme: 'uuid-v7' }));
    expect(run({ scheme: 'uuid-v4', seed: 8 }).rows[0].key).not.toBe(run({ scheme: 'uuid-v4' }).rows[0].key);
  });

  it('rank 는 정렬한 자리이고 1 부터 n 까지 한 번씩 나와요', () => {
    const r = run({ scheme: 'uuid-v4' });
    expect(r.rows.map((x) => x.rank).sort((a, b) => a - b)).toEqual(r.rows.map((_, i) => i + 1));
  });

  it('길이가 다른 숫자 문자열도 값 크기 순으로 비교해요', () => {
    expect(compareKeys('9', '10')).toBeLessThan(0);
    expect(compareKeys('1000', '999')).toBeGreaterThan(0);
  });

  it('naiveNext 는 숫자는 1 을 더하고 UUID 는 끝 4자리에 1 을 더해요', () => {
    expect(naiveNext('41', 'serial')).toBe('42');
    expect(naiveNext('00000000-0000-4000-8000-00000000ffff', 'uuid-v4')).toBe('00000000-0000-4000-8000-000000000000');
  });
});
