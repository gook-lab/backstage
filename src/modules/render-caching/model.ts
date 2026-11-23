/** shared: 공용 HTML 한 벌만 있다. mixed: 로그인 여부로 한 HTML 안의 헤더가 달라진다. split: 공용 HTML 과 개인 부분을 따로 요청한다 */
export type Layout = 'shared' | 'mixed' | 'split';

/** request: 요청마다 렌더링. revalidate: 간격이 지나면 다시 렌더링. build: 배포 때만 렌더링 */
export type RenderMode = 'request' | 'revalidate' | 'build';

export interface Scenario {
  readonly layout: Layout;
  readonly mode: RenderMode;
  /** revalidate 모드의 재검증 간격 (초) */
  readonly revalidateSeconds: number;
  /** 로그인 사용자 비율 (0~1) */
  readonly loggedInRatio: number;
  /** 초당 상품 페이지 요청 수 (예시) */
  readonly requestsPerSecond: number;
  /** 가격이 바뀌는 시각 (0시부터 초) */
  readonly changeAtSecond: number;
}

export interface Result {
  /** 하루 동안 상품 페이지 요청 수 */
  readonly pageRequests: number;
  /** 원 서버에서 상품 페이지 HTML 을 만든 횟수 */
  readonly originRenders: number;
  /** split 에서 개인 부분을 원 서버에 따로 요청한 횟수 */
  readonly personalCalls: number;
  /** 공유 캐시가 답한 페이지 요청 수 */
  readonly cacheServed: number;
  /** 변경 뒤 옛 가격을 담은 응답 수 */
  readonly oldServed: number;
  /** 변경 뒤 옛 가격 응답이 마지막으로 나간 시각 − 변경 시각 (초). 옛 가격이 없었으면 0 */
  readonly oldExposureSeconds: number;
}

export const DAY_SECONDS = 24 * 60 * 60;
/** 예시: 6시간마다 한 번 배포한다고 가정해요 */
export const BUILD_INTERVAL_SECONDS = 6 * 60 * 60;

export const DEFAULT_SCENARIO: Scenario = {
  layout: 'mixed',
  mode: 'revalidate',
  revalidateSeconds: 60,
  loggedInRatio: 0.3,
  requestsPerSecond: 20,
  changeAtSecond: 13 * 60 * 60,
};

/** 하루(0~86400초)를 1초씩 돌려 원 서버 호출과 옛 가격 노출을 센다.
 *  같은 페이지의 요청은 한 캐시 노드를 쓴다고 가정하고, 쿠키가 붙은 요청은 공유 캐시를 건너뛴다고 가정한다(예시). */
export function simulate(s: Scenario): Result {
  const ratio = Math.min(Math.max(s.loggedInRatio, 0), 1);
  const rps = s.requestsPerSecond;
  const isMixed = s.layout === 'mixed';
  const bypassCount = isMixed ? rps * ratio : 0;
  const sharedCount = rps - bypassCount;
  const personalCount = s.layout === 'split' ? rps * ratio : 0;
  const change = s.changeAtSecond;

  let originRenders = 0;
  let personalCalls = 0;
  let cacheServed = 0;
  let oldServed = 0;
  let lastOldAt = -1;
  let cached: { at: number; isNew: boolean } | null = null;

  for (let t = 0; t < DAY_SECONDS; t++) {
    const isNew = t >= change;
    // 쿠키가 붙은 요청은 공유 캐시를 건너뛰고 매번 렌더링한다
    originRenders += bypassCount;
    personalCalls += personalCount;

    if (s.mode === 'request') {
      originRenders += sharedCount;
      continue;
    }

    if (s.mode === 'build') {
      // 공용 HTML 은 배포 때 한 번 만들고, 그 뒤로는 정적 파일처럼 나간다
      if (t % BUILD_INTERVAL_SECONDS === 0) originRenders += 1;
      cacheServed += sharedCount;
      const builtAt = Math.floor(t / BUILD_INTERVAL_SECONDS) * BUILD_INTERVAL_SECONDS;
      if (t >= change && builtAt < change) {
        oldServed += sharedCount;
        lastOldAt = t;
      }
      continue;
    }

    // revalidate: 저장본이 간격 안이면 저장본을 쓰고, 지났으면 한 번 렌더링해서 다시 저장한다
    if (cached === null || t - cached.at >= s.revalidateSeconds) {
      originRenders += 1;
      cached = { at: t, isNew };
      cacheServed += Math.max(sharedCount - 1, 0);
    } else {
      cacheServed += sharedCount;
    }
    if (!cached.isNew && t >= change) {
      oldServed += sharedCount;
      lastOldAt = t;
    }
  }

  const oldExposureSeconds = lastOldAt >= change ? lastOldAt + 1 - change : 0;

  return {
    pageRequests: rps * DAY_SECONDS,
    originRenders,
    personalCalls,
    cacheServed,
    oldServed,
    oldExposureSeconds,
  };
}

export function hitRate(r: Result): number {
  return r.pageRequests === 0 ? 0 : r.cacheServed / r.pageRequests;
}

/** 0초, 45초, 10분, 3시간 5분 같은 짧은 표기 */
export function formatSeconds(sec: number): string {
  if (sec <= 0) return '0초';
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  const hour = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin === 0 ? `${hour}시간` : `${hour}시간 ${restMin}분`;
}
