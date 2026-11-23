import {
  ACCEPT_SEC,
  BYTES_PER_ROW,
  escapeCsvField,
  estimateExport,
  guardField,
  hasFormulaRisk,
  MEMORY_FACTOR,
} from './model';

const base = { rows: 100_000, batchSize: 1_000, gatewayLimitSec: 30 };

describe('대용량 내보내기 모델', () => {
  it('메모리에 모아 응답하면 첫 바이트가 끝 시각과 같고, 10만 건은 30초 제한을 넘어 504 가 된다', () => {
    const e = estimateExport({ ...base, method: 'memory' });
    expect(e.firstByteSec).toBe(e.doneSec);
    expect(e.doneSec).toBeCloseTo(40, 5);
    expect(e.gatewayTimeout).toBe(true);
  });

  it('스트리밍은 첫 배치만 기다려서 같은 10만 건도 제한에 걸리지 않고, 끝 시각은 메모리 방식과 같다', () => {
    const e = estimateExport({ ...base, method: 'stream' });
    expect(e.firstByteSec).toBeCloseTo(0.4, 5);
    expect(e.gatewayTimeout).toBe(false);
    expect(e.doneSec).toBeCloseTo(40, 5);
  });

  it('스트리밍 서버 메모리는 행 수와 상관없이 배치 크기로 정해진다', () => {
    const small = estimateExport({ ...base, rows: 100_000, method: 'stream' });
    const large = estimateExport({ ...base, rows: 1_000_000, method: 'stream' });
    expect(large.peakMemoryMB).toBeCloseTo(small.peakMemoryMB, 10);
  });

  it('메모리에 모아 응답하면 서버 메모리가 행 수에 비례해서 10배가 된다', () => {
    const a = estimateExport({ ...base, rows: 100_000, method: 'memory' });
    const b = estimateExport({ ...base, rows: 1_000_000, method: 'memory' });
    expect(a.peakMemoryMB).toBeCloseTo((100_000 * BYTES_PER_ROW * MEMORY_FACTOR) / 1_000_000, 10);
    expect(b.peakMemoryMB / a.peakMemoryMB).toBeCloseTo(10, 5);
  });

  it('비동기 방식은 202 접수가 제한 안에서 끝나고, 파일은 접수 뒤 전체 시간만큼 지나 준비된다', () => {
    const e = estimateExport({ ...base, method: 'async' });
    expect(e.firstByteSec).toBe(ACCEPT_SEC);
    expect(e.gatewayTimeout).toBe(false);
    expect(e.doneSec).toBeCloseTo(ACCEPT_SEC + 40, 5);
  });

  it('배치가 제한보다 오래 걸리면 스트리밍도 504 로 끊긴다', () => {
    const e = estimateExport({ rows: 100_000, batchSize: 10_000, gatewayLimitSec: 3, method: 'stream' });
    expect(e.firstByteSec).toBeCloseTo(4, 5);
    expect(e.gatewayTimeout).toBe(true);
  });

  it('쉼표, 큰따옴표, 줄바꿈이 든 값은 감싸고 큰따옴표를 두 번 쓴다', () => {
    expect(escapeCsvField('홍길동')).toBe('홍길동');
    expect(escapeCsvField('서울, 강남')).toBe('"서울, 강남"');
    expect(escapeCsvField('그는 "좋아요"')).toBe('"그는 ""좋아요"""');
    expect(escapeCsvField('첫 줄\n둘째 줄')).toBe('"첫 줄\n둘째 줄"');
  });

  it('셀이 = + - @ 나 탭으로 시작하면 수식 주입 위험으로 보고, 가운데 기호는 위험으로 보지 않는다', () => {
    expect(hasFormulaRisk('=1+2')).toBe(true);
    expect(hasFormulaRisk('-3000')).toBe(true);
    expect(hasFormulaRisk('\tabc')).toBe(true);
    expect(hasFormulaRisk('a=1')).toBe(false);
    expect(hasFormulaRisk('홍길동')).toBe(false);
  });

  it('작은 따옴표 방식은 앞에 따옴표를 붙이고, 탭 방식은 따옴표 안 맨 앞에 탭을 넣는다', () => {
    expect(guardField('=1+2', 'none')).toBe('=1+2');
    expect(guardField('=1+2', 'apostrophe')).toBe("'=1+2");
    expect(guardField('=1+2', 'tab')).toBe('"\t=1+2"');
    expect(guardField('홍길동', 'tab')).toBe('홍길동');
  });
});
