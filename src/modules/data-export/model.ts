export type Method = 'memory' | 'stream' | 'async';
export type Guard = 'none' | 'apostrophe' | 'tab';

export const METHODS: readonly Method[] = ['memory', 'stream', 'async'];
export const METHOD_LABEL: Record<Method, string> = {
  memory: '메모리에 모아 응답',
  stream: '스트리밍 응답',
  async: '비동기 파일 생성',
};
export const METHOD_HINT: Record<Method, string> = {
  memory: '행을 전부 읽고 CSV 문자열을 만든 뒤에야 첫 바이트를 보내요.',
  stream: '행을 배치로 읽으며 응답에 바로 써요. 서버 메모리는 배치 하나 분량이에요.',
  async: '요청은 접수만 하고, 워커가 파일을 만든 뒤 만료되는 링크를 줘요.',
};

/** 행 수 단계. 예시 값이에요 */
export const ROW_STEPS: readonly number[] = [1_000, 10_000, 50_000, 100_000, 300_000, 1_000_000];
/** 행 하나를 읽고 CSV 한 줄로 바꾸는 시간 (ms). 예시 값이에요 */
export const MS_PER_ROW = 0.4;
/** 행 하나의 CSV 바이트 수. 예시 값이에요 */
export const BYTES_PER_ROW = 200;
/** 행 객체 · 문자열 · 응답 버퍼가 같은 데이터를 복사하는 배수. 예시 값이에요 */
export const MEMORY_FACTOR = 3;
/** 비동기 방식에서 접수하고 202 를 돌려주는 시간 (초). 예시 값이에요 */
export const ACCEPT_SEC = 0.2;

export interface ExportParams {
  readonly method: Method;
  readonly rows: number;
  readonly batchSize: number;
  readonly gatewayLimitSec: number;
}

export interface ExportEstimate {
  /** 응답 본문의 첫 바이트가 나가는 시각 (초). 비동기는 202 접수 응답 */
  readonly firstByteSec: number;
  /** 바이트가 나가는 사이 가장 긴 공백 (초) */
  readonly longestGapSec: number;
  /** 파일이 끝나는 시각 (초). 비동기는 파일이 준비되는 시각 */
  readonly doneSec: number;
  /** 서버 최대 메모리 (MB). 비동기는 워커 기준 */
  readonly peakMemoryMB: number;
  /** 게이트웨이 제한을 넘어 504 로 끊기는지. 모델 가정은 시뮬레이터 안내를 봐요 */
  readonly gatewayTimeout: boolean;
}

const toSec = (ms: number) => ms / 1000;
const toMB = (bytes: number) => bytes / 1_000_000;

/**
 * 게이트웨이 가정: 방식이 '첫 바이트'를 기다리는 제한은 memory 와 비동기 접수에 걸리고,
 * 스트리밍은 바이트 사이의 공백이 제한보다 길 때만 걸린다고 봐요.
 */
export function estimateExport(p: ExportParams): ExportEstimate {
  const rows = Math.max(0, Math.floor(p.rows));
  const batch = Math.max(1, Math.min(Math.floor(p.batchSize), Math.max(rows, 1)));
  const batchSec = toSec(batch * MS_PER_ROW);
  const totalSec = toSec(rows * MS_PER_ROW);

  switch (p.method) {
    case 'memory':
      return {
        firstByteSec: totalSec,
        longestGapSec: totalSec,
        doneSec: totalSec,
        peakMemoryMB: toMB(rows * BYTES_PER_ROW * MEMORY_FACTOR),
        gatewayTimeout: totalSec > p.gatewayLimitSec,
      };
    case 'stream':
      return {
        firstByteSec: batchSec,
        longestGapSec: batchSec,
        doneSec: totalSec,
        peakMemoryMB: toMB(batch * BYTES_PER_ROW * MEMORY_FACTOR),
        gatewayTimeout: batchSec > p.gatewayLimitSec,
      };
    case 'async':
      return {
        firstByteSec: ACCEPT_SEC,
        longestGapSec: ACCEPT_SEC,
        doneSec: ACCEPT_SEC + totalSec,
        peakMemoryMB: toMB(batch * BYTES_PER_ROW * MEMORY_FACTOR),
        gatewayTimeout: ACCEPT_SEC > p.gatewayLimitSec,
      };
  }
}

export function formatSec(sec: number): string {
  return sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(1)} 초`;
}

export function formatMB(mb: number): string {
  return mb < 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb).toLocaleString('ko-KR')} MB`;
}

/** RFC 4180: 쉼표, 큰따옴표, CR, LF 가 든 필드는 큰따옴표로 감싸고, 안의 큰따옴표는 두 번 써요 */
export function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** OWASP 가 든 수식 시작 문자: = + - @ 탭 CR LF, 전각 변형 */
export function hasFormulaRisk(value: string): boolean {
  return /^[=+\-@\t\r\n＝＋－＠]/.test(value);
}

export function guardField(value: string, guard: Guard): string {
  if (!hasFormulaRisk(value) || guard === 'none') return escapeCsvField(value);
  if (guard === 'apostrophe') return escapeCsvField(`'${value}`);
  // OWASP 가 엑셀에서 관찰됐다고 설명한 방식: 따옴표 안 맨 앞에 탭
  return `"\t${value.replace(/"/g, '""')}"`;
}
