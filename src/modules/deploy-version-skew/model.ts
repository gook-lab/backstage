export type Strategy = 'rolling' | 'blueGreen' | 'canary';
export type ApiChange = 'immediate' | 'expandContract';

export interface Options {
  readonly strategy: Strategy;
  /** 옛 해시 파일을 새 배포에도 남기는지 */
  readonly keepAssets: boolean;
  /** immediate: 필드를 바로 뺌. expandContract: 이번 배포는 필드를 더하고, 빼는 일은 창 밖으로 미룸 */
  readonly apiChange: ApiChange;
}

export const DEFAULT_OPTIONS: Options = {
  strategy: 'rolling',
  keepAssets: false,
  apiChange: 'immediate',
};

/** 예시 값. 실제 비율은 트래픽과 배포 설정에 따라 달라요 */
export const CANARY_SHARE = 0.1;
/** 예시: 옛 탭 요청 가운데 지연 로드하는 청크를 받는 비율 */
export const CHUNK_SHARE = 0.4;
/** 칸 0은 배포 전이고, 칸 1부터 배포 진행 단계예요. 시간 간격은 예시예요 */
export const STEP_COUNT = 12;
const BLUE_GREEN_SWITCH_STEP = 2;
const CANARY_FULL_STEP = 4;

/** 칸마다 서버 응답이 새 버전에서 온 비율 */
export function newShareAt(strategy: Strategy, step: number): number {
  if (step <= 0) return 0;
  if (strategy === 'rolling') return Math.min(1, step * 0.25);
  if (strategy === 'blueGreen') return step >= BLUE_GREEN_SWITCH_STEP ? 1 : 0;
  return step >= CANARY_FULL_STEP ? 1 : CANARY_SHARE;
}

export interface StepResult {
  readonly step: number;
  /** 새 버전 응답 비율 (정수 %) */
  readonly newShare: number;
  /** 옛 탭 요청 결과 (정수 %). 세 값의 합은 100이에요 */
  readonly ok: number;
  readonly missing: number;
  readonly chunk404: number;
}

const pct = (x: number) => Math.round(x * 100);

/** 옛 탭의 요청 한 건이 새 서버에 닿으면 API 는 옛 필드를 잃고, 청크는 옛 해시 파일이 없으면 404 가 돼요 */
export function simulate(options: Options): StepResult[] {
  return Array.from({ length: STEP_COUNT }, (_, step) => {
    const newShare = newShareAt(options.strategy, step);
    const missing = options.apiChange === 'immediate' ? pct((1 - CHUNK_SHARE) * newShare) : 0;
    const chunk404 = options.keepAssets ? 0 : pct(CHUNK_SHARE * newShare);
    return { step, newShare: pct(newShare), ok: 100 - missing - chunk404, missing, chunk404 };
  });
}

/** 깨진 요청이 하나라도 있는 칸 수 */
export function brokenSteps(results: readonly StepResult[]): number {
  return results.filter((r) => r.missing + r.chunk404 > 0).length;
}
