/** server: 서버가 값을 정하고 화면이 따른다. client: 화면이 값을 정하고 서버가 따른다. both: 화면과 서버가 각자 평가한다 */
export type Mode = 'server' | 'client' | 'both';
/** hash: 사용자 id 버킷으로 고정. random: 평가할 때마다 새로 뽑는다 */
export type Assignment = 'hash' | 'random';

export interface Params {
  /** 출시 비율 0~100 (%) */
  readonly ratio: number;
  /** 캐시 지연. 몇 번째 방문부터 새 규칙을 보는지 */
  readonly lag: number;
  readonly mode: Mode;
  readonly assignment: Assignment;
}

export interface Result {
  readonly exposedUsers: number;
  readonly exposedRequests: number;
  readonly mismatchRequests: number;
  readonly totalRequests: number;
}

export const USER_COUNT = 1000;
export const VISITS = 4;
export const MAX_LAG = VISITS - 1;
/** 시뮬레이터 난수 시드. 같은 입력이면 같은 결과가 나온다 */
export const SEED = 1124;
/** 플래그마다 다른 접두어를 붙이면 A 기능에 뽑힌 사람이 B 기능에서도 항상 뽑히지 않는다 */
const FLAG_SALT = 'new-payment';

export function userId(index: number): string {
  return `u-${String(index + 1).padStart(4, '0')}`;
}

/** 32비트 FNV-1a. 같은 입력에는 항상 같은 값을 준다. 이 시뮬레이터가 쓰는 함수이고, 운영 시스템의 해시는 다루지 않는다 */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 사용자 id를 0~99 버킷으로 바꾼다 */
export function bucketOf(id: string): number {
  return hash32(`${FLAG_SALT}:${id}`) % 100;
}

/** mulberry32. 같은 시드면 같은 난수 열을 준다 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draw = () => number;

function inRollout(assignment: Assignment, id: string, ratio: number, draw: Draw): boolean {
  if (assignment === 'hash') return bucketOf(id) < ratio;
  return draw() * 100 < ratio;
}

/** 캐시 지연 전에는 옛 규칙(0%)을 본다 */
function viewAt(p: Pick<Params, 'ratio' | 'assignment'>, id: string, visit: number, lag: number, draw: Draw): boolean {
  return visit >= lag && inRollout(p.assignment, id, p.ratio, draw);
}

function evaluate(p: Params, id: string, visit: number, draw: Draw): { screen: boolean; server: boolean } {
  if (p.mode === 'server') {
    const server = viewAt(p, id, visit, p.lag, draw);
    return { screen: server, server };
  }
  if (p.mode === 'client') {
    const screen = viewAt(p, id, visit, p.lag, draw);
    return { screen, server: screen };
  }
  // both: 화면은 매번 최신 규칙을 읽고, 서버는 캐시 지연만큼 옛 규칙을 본다
  const screen = viewAt(p, id, visit, 0, draw);
  const server = viewAt(p, id, visit, p.lag, draw);
  return { screen, server };
}

/** 사용자 1,000명이 방문 4번 하는 동안 노출과 불일치를 센다 */
export function simulate(p: Params): Result {
  const draw = seededRandom(SEED);
  let exposedUsers = 0;
  let exposedRequests = 0;
  let mismatchRequests = 0;

  for (let u = 0; u < USER_COUNT; u++) {
    const id = userId(u);
    let everExposed = false;
    for (let visit = 0; visit < VISITS; visit++) {
      const { screen, server } = evaluate(p, id, visit, draw);
      if (screen) {
        exposedRequests++;
        everExposed = true;
      }
      if (screen !== server) mismatchRequests++;
    }
    if (everExposed) exposedUsers++;
  }

  return { exposedUsers, exposedRequests, mismatchRequests, totalRequests: USER_COUNT * VISITS };
}

/** 같은 규칙에서 방문 4번 중 결과가 한 번이라도 바뀐 사용자 수. 캐시 지연과 무관하다 */
export function countFlipUsers(assignment: Assignment, ratio: number): number {
  const draw = seededRandom(SEED);
  let flips = 0;
  for (let u = 0; u < USER_COUNT; u++) {
    const id = userId(u);
    const first = inRollout(assignment, id, ratio, draw);
    let changed = false;
    for (let visit = 1; visit < VISITS; visit++) {
      if (inRollout(assignment, id, ratio, draw) !== first) changed = true;
    }
    if (changed) flips++;
  }
  return flips;
}
