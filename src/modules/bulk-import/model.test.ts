import { moduleById } from '..';
import { describe, expect, it } from 'vitest';
import { EMPTY_STORE, escapeCsvCell, parseCsv, SAMPLE_CSV, type Store, upload } from './model';

const TWO_GOOD_ROWS = ['sku,name,price,stock', 'A-1,머그컵,12000,30', 'A-2,접시,5000,3'].join('\n');

function skus(store: Store): string[] {
  return store.rows.map((r) => r.sku);
}

describe('CSV 읽기 (RFC 4180)', () => {
  it('큰따옴표 안의 쉼표와 따옴표 두 개를 한 칸으로 읽어요', () => {
    const parsed = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n');
    expect(parsed.records).toEqual([['x, y', 'say "hi"']]);
  });

  it('큰따옴표 안의 줄바꿈은 같은 칸에 남고, 행은 늘지 않아요', () => {
    const parsed = parseCsv('a,b\n"line1\nline2",2\n');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0][0]).toBe('line1\nline2');
  });

  it('CRLF 와 LF 를 모두 줄 끝으로 읽어요', () => {
    expect(parseCsv('a\r\n1\r\n2').records).toEqual([['1'], ['2']]);
    expect(parseCsv('a\n1\n2\n').records).toEqual([['1'], ['2']]);
  });

  it('파일 맨 앞 BOM 을 알아채고 헤더 이름에서 떼어 내요', () => {
    const parsed = parseCsv('﻿sku,name,price,stock\r\nA-1,머그컵,1,1');
    expect(parsed.bom).toBe(true);
    expect(parsed.header).toEqual(['sku', 'name', 'price', 'stock']);
  });
});

describe('파일 검사', () => {
  it('열 이름이 빠진 파일은 파일 단위 오류로 멈춰요', () => {
    const result = upload(EMPTY_STORE, 'sku,name,stock\nA-1,머그컵,3', { strategy: 'partial', keyed: true });
    expect(result.report.committed).toBe(false);
    expect(result.report.fileError).toContain('price');
    expect(result.store.rows).toHaveLength(0);
  });

  it('열 개수가 맞지 않는 행은 행 전체 오류로 보고해요', () => {
    const result = upload(EMPTY_STORE, 'sku,name,price,stock\nA-1,머그컵,1', { strategy: 'partial', keyed: true });
    expect(result.report.errors).toEqual([{ row: 2, column: '(행 전체)', reason: '열이 4개여야 하는데 3개예요' }]);
  });

  it('빈 가격과 음수 재고, 정수가 아닌 가격을 행 번호와 열 이름으로 알려 줘요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'partial', keyed: true });
    expect(result.report.errors).toEqual(
      expect.arrayContaining([
        { row: 3, column: 'price', reason: '비어 있어요' },
        { row: 4, column: 'stock', reason: '음수는 쓸 수 없어요' },
        { row: 7, column: 'price', reason: '숫자만 쓸 수 있어요' },
      ]),
    );
  });
});

describe('처리 방식', () => {
  it('행별 부분 성공은 맞는 행만 저장하고 틀린 행은 모두 보고해요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'partial', keyed: true });
    expect(skus(result.store)).toEqual(['A-100', 'A-103']);
    expect(result.report.committed).toBe(true);
    expect(result.report.rejectedRows).toBe(4);
    expect(result.report.errors.map((e) => e.row)).toEqual([3, 4, 6, 7]);
  });

  it('전체 롤백은 첫 오류에서 멈추고 아무 행도 저장하지 않아요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'rollback', keyed: true });
    expect(result.store.rows).toHaveLength(0);
    expect(result.report.committed).toBe(false);
    expect(result.report.errors.map((e) => e.row)).toEqual([3]);
    expect(result.report.unchecked).toBe(4);
  });

  it('검증 후 확정은 오류가 있으면 전체 오류를 모두 보여 주고 저장하지 않아요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'dry-run', keyed: true });
    expect(result.store.rows).toHaveLength(0);
    expect(result.report.committed).toBe(false);
    expect(result.report.rejectedRows).toBe(4);
    expect(result.report.unchecked).toBe(0);
  });

  it('검증 후 확정은 오류가 없으면 전부 저장해요', () => {
    const result = upload(EMPTY_STORE, TWO_GOOD_ROWS, { strategy: 'dry-run', keyed: true });
    expect(result.report.committed).toBe(true);
    expect(result.report.inserted).toBe(2);
  });
});

describe('다시 올리기 (멱등성)', () => {
  it('업서트 키가 있으면 같은 파일을 다시 올려도 행이 늘지 않고 고쳐 써요', () => {
    const first = upload(EMPTY_STORE, TWO_GOOD_ROWS, { strategy: 'partial', keyed: true });
    const second = upload(first.store, TWO_GOOD_ROWS, { strategy: 'partial', keyed: true });
    expect(second.store.rows).toHaveLength(2);
    expect(second.report.inserted).toBe(0);
    expect(second.report.updated).toBe(2);
  });

  it('업서트 키가 없으면 같은 파일을 다시 올릴 때마다 행이 늘어요', () => {
    const first = upload(EMPTY_STORE, TWO_GOOD_ROWS, { strategy: 'partial', keyed: false });
    const second = upload(first.store, TWO_GOOD_ROWS, { strategy: 'partial', keyed: false });
    expect(second.store.rows).toHaveLength(4);
  });

  it('업서트 키가 있으면 파일 안의 같은 sku 두 번째 행을 중복으로 거절해요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'partial', keyed: true });
    const dup = result.report.errors.find((e) => e.row === 6);
    expect(dup).toEqual({ row: 6, column: 'sku', reason: '2행과 같은 sku예요' });
  });

  it('업서트 키가 없으면 같은 파일 안의 중복 sku 도 둘 다 저장해요', () => {
    const result = upload(EMPTY_STORE, SAMPLE_CSV, { strategy: 'partial', keyed: false });
    expect(skus(result.store)).toEqual(['A-100', 'A-103', 'A-100']);
  });
});

describe('CSV 내보내기 수식 주입 방지', () => {
  it('수식으로 읽힐 수 있는 첫 글자 앞에는 탭을 넣어요', () => {
    expect(escapeCsvCell('=1+2')).toBe('"\t=1+2"');
    expect(escapeCsvCell('@SUM(A1)')).toBe('"\t@SUM(A1)"');
  });

  it('평범한 값은 그대로 두고, 안의 따옴표는 두 번 써요', () => {
    expect(escapeCsvCell('머그컵')).toBe('"머그컵"');
    expect(escapeCsvCell('잔 "특별판"')).toBe('"잔 ""특별판"""');
  });
});

describe('모듈 연결', () => {
  it('글이 링크하는 모듈이 레지스트리에 있어요', () => {
    expect(moduleById('batch-jobs')).toBeDefined();
    expect(moduleById('background-jobs')).toBeDefined();
    expect(moduleById('transactions')).toBeDefined();
    expect(moduleById('api-errors')).toBeDefined();
  });
});
