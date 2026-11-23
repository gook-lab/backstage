import { bucketOf, countFlipUsers, simulate, userId, USER_COUNT } from './model';

const countInBucketBelow = (ratio: number) => {
  let n = 0;
  for (let u = 0; u < USER_COUNT; u++) if (bucketOf(userId(u)) < ratio) n++;
  return n;
};

describe('기능 플래그 시뮬레이터 모델', () => {
  it('같은 사용자 id는 항상 같은 버킷을 받아요', () => {
    expect(bucketOf('u-0001')).toBe(bucketOf('u-0001'));
    expect(bucketOf('u-0001')).toBeGreaterThanOrEqual(0);
    expect(bucketOf('u-0001')).toBeLessThan(100);
  });

  it('해시 배정은 5% 출시에서 1,000명 중 대략 5%를 뽑아요', () => {
    const picked = countInBucketBelow(5);
    expect(picked).toBeGreaterThanOrEqual(30);
    expect(picked).toBeLessThanOrEqual(70);
  });

  it('출시 비율을 올리면 이미 노출된 사용자는 그대로 노출돼요', () => {
    const at5 = simulate({ ratio: 5, lag: 0, mode: 'server', assignment: 'hash' });
    const at10 = simulate({ ratio: 10, lag: 0, mode: 'server', assignment: 'hash' });
    expect(at10.exposedUsers).toBeGreaterThanOrEqual(at5.exposedUsers);
    expect(at10.exposedUsers).toBe(countInBucketBelow(10));
  });

  it('해시 배정은 같은 규칙에서 방문마다 결과가 흔들리지 않아요', () => {
    expect(countFlipUsers('hash', 5)).toBe(0);
    expect(countFlipUsers('hash', 50)).toBe(0);
  });

  it('무작위 배정은 같은 비율에서도 결과가 바뀌는 사용자가 생겨요', () => {
    const flips = countFlipUsers('random', 5);
    expect(flips).toBeGreaterThan(100);
    expect(flips).toBeLessThan(300);
    expect(countFlipUsers('random', 0)).toBe(0);
  });

  it('서버 평가에서 캐시 지연이 커지면 노출 요청이 줄어요', () => {
    const picked = countInBucketBelow(50);
    const fresh = simulate({ ratio: 50, lag: 0, mode: 'server', assignment: 'hash' });
    const slow = simulate({ ratio: 50, lag: 3, mode: 'server', assignment: 'hash' });
    expect(fresh.exposedRequests).toBe(4 * picked);
    expect(slow.exposedRequests).toBe(1 * picked);
  });

  it('서버 평가는 화면이 서버 값을 따르므로 캐시 지연이 있어도 불일치가 없어요', () => {
    const result = simulate({ ratio: 50, lag: 2, mode: 'server', assignment: 'hash' });
    expect(result.mismatchRequests).toBe(0);
  });

  it('클라이언트 평가는 서버가 화면 값을 따르므로 불일치가 없어요', () => {
    const result = simulate({ ratio: 50, lag: 2, mode: 'client', assignment: 'hash' });
    expect(result.mismatchRequests).toBe(0);
  });

  it('둘 다 각자 평가에서 서버만 옛 규칙을 보면 화면과 서버가 어긋난 요청이 생겨요', () => {
    // 화면은 최신 규칙으로 새 결제를 보여 주고, 서버는 처음 2번 방문 동안 옛 규칙으로 처리해요
    const picked = countInBucketBelow(50);
    const result = simulate({ ratio: 50, lag: 2, mode: 'both', assignment: 'hash' });
    expect(result.mismatchRequests).toBe(2 * picked);
  });

  it('둘 다 각자 평가라도 캐시 지연이 없으면 해시 배정에서는 어긋나지 않아요', () => {
    const result = simulate({ ratio: 50, lag: 0, mode: 'both', assignment: 'hash' });
    expect(result.mismatchRequests).toBe(0);
  });

  it('둘 다 각자 평가에서 무작위 배정은 지연이 없어도 어긋나요', () => {
    const result = simulate({ ratio: 50, lag: 0, mode: 'both', assignment: 'random' });
    expect(result.mismatchRequests).toBeGreaterThan(0);
  });

  it('같은 입력은 두 번 돌려도 같은 결과를 줘요', () => {
    const p = { ratio: 30, lag: 1, mode: 'both', assignment: 'random' } as const;
    expect(simulate(p)).toEqual(simulate(p));
  });
});
