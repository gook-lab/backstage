/** 시뮬레이터가 다루는 열. 상품 한 행은 이 네 칸을 가진다고 정한다 */
export const COLUMNS = ['sku', 'name', 'price', 'stock'] as const;

export type Strategy = 'rollback' | 'partial' | 'dry-run';

export const STRATEGIES: readonly Strategy[] = ['rollback', 'partial', 'dry-run'];

export const STRATEGY_LABEL: Record<Strategy, string> = {
  rollback: '전체 롤백',
  partial: '행별 부분 성공',
  'dry-run': '검증 후 확정',
};

export interface ProductRow {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly stock: number;
}

/** 엑셀과 같은 행 번호. 헤더가 1행이고 첫 데이터 행은 2행이에요 */
export interface CellError {
  readonly row: number;
  readonly column: string;
  readonly reason: string;
}

export interface Store {
  readonly rows: readonly ProductRow[];
}

export const EMPTY_STORE: Store = { rows: [] };

export interface Report {
  readonly strategy: Strategy;
  /** 이번 올리기가 확정돼 저장됐는지 */
  readonly committed: boolean;
  readonly inserted: number;
  readonly updated: number;
  /** 거절된 행의 오류. 롤백은 처음 오류가 난 행 하나만 담아요 */
  readonly errors: readonly CellError[];
  readonly rejectedRows: number;
  /** 롤백에서 첫 오류 뒤에 확인하지 않은 행 수 */
  readonly unchecked: number;
  /** 파일 전체를 읽지 못한 이유. 있으면 행은 하나도 처리하지 않아요 */
  readonly fileError: string | null;
}

export interface ParsedCsv {
  /** 파일 맨 앞에 BOM(U+FEFF)이 있었는지 */
  readonly bom: boolean;
  readonly header: readonly string[];
  readonly records: readonly (readonly string[])[];
}

/**
 * RFC 4180 형식의 CSV 를 읽어요. 큰따옴표로 감싼 칸 안의 쉼표 · 줄바꿈을 한 칸으로 보고,
 * 따옴표 두 개("")는 따옴표 한 개로 읽어요. CRLF 와 LF 를 모두 줄 끝으로 받아요.
 */
export function parseCsv(input: string): ParsedCsv {
  const bom = input.charCodeAt(0) === 0xfeff;
  const text = bom ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          quoted = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i += 1;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header = [], ...records] = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  return { bom, header, records };
}

export interface CheckedRow {
  readonly row: number;
  readonly value: ProductRow | null;
  readonly errors: readonly CellError[];
}

const DIGITS = /^\d+$/;
const NEGATIVE = /^-\d+$/;

function checkCount(raw: string): string | null {
  if (raw === '') return '비어 있어요';
  if (NEGATIVE.test(raw)) return '음수는 쓸 수 없어요';
  if (!DIGITS.test(raw)) return '숫자만 쓸 수 있어요';
  return null;
}

/**
 * 헤더와 행 하나하나를 검사해요. 파일 단위 문제(열 없음)는 fileError 로 따로 돌려줘요.
 * keyed 가 true 면 같은 sku 가 파일 안에서 두 번째로 나올 때 중복 오류를 붙여요.
 */
export function checkFile(parsed: ParsedCsv, keyed: boolean): { fileError: string | null; rows: CheckedRow[] } {
  const missing = COLUMNS.filter((c) => !parsed.header.includes(c));
  if (missing.length > 0) {
    return { fileError: `헤더에 ${missing.join(', ')} 열이 없어요`, rows: [] };
  }

  const firstRowOf = new Map<string, number>();
  const rows = parsed.records.map((record, k): CheckedRow => {
    const row = k + 2;
    if (record.length !== parsed.header.length) {
      return {
        row,
        value: null,
        errors: [
          { row, column: '(행 전체)', reason: `열이 ${parsed.header.length}개여야 하는데 ${record.length}개예요` },
        ],
      };
    }

    const cell = (column: string) => record[parsed.header.indexOf(column)] ?? '';
    const errors: CellError[] = [];
    const sku = cell('sku');
    const name = cell('name');
    const priceRaw = cell('price');
    const stockRaw = cell('stock');

    if (sku === '') errors.push({ row, column: 'sku', reason: '비어 있어요' });
    if (name === '') errors.push({ row, column: 'name', reason: '비어 있어요' });

    const priceProblem = checkCount(priceRaw);
    if (priceProblem) errors.push({ row, column: 'price', reason: priceProblem });
    const stockProblem = checkCount(stockRaw);
    if (stockProblem) errors.push({ row, column: 'stock', reason: stockProblem });

    if (keyed && sku !== '') {
      const first = firstRowOf.get(sku);
      if (first === undefined) firstRowOf.set(sku, row);
      else errors.push({ row, column: 'sku', reason: `${first}행과 같은 sku예요` });
    }

    if (errors.length > 0) return { row, value: null, errors };
    return {
      row,
      value: { sku, name, price: Number(priceRaw), stock: Number(stockRaw) },
      errors: [],
    };
  });

  return { fileError: null, rows };
}

function applyRow(store: Store, value: ProductRow, keyed: boolean): { store: Store; kind: 'inserted' | 'updated' } {
  const index = keyed ? store.rows.findIndex((r) => r.sku === value.sku) : -1;
  if (index >= 0) {
    const rows = store.rows.map((r, i) => (i === index ? value : r));
    return { store: { rows }, kind: 'updated' };
  }
  return { store: { rows: [...store.rows, value] }, kind: 'inserted' };
}

/**
 * 파일 하나를 올려요. 저장 결과와 보고서를 함께 돌려줘요.
 * - rollback: 한 트랜잭션으로 보고 첫 오류에서 멈춘 뒤 전부 되돌려요.
 * - partial: 행마다 따로 확정해서 맞는 행만 저장하고, 틀린 행의 오류를 모두 보고해요.
 * - dry-run: 저장 없이 전체를 검사해요. 오류가 하나도 없을 때만 전부 저장해요.
 * keyed 가 true 면 sku 를 업서트 키로 보고 같은 sku 는 고쳐 써요. false 면 항상 새로 넣어요.
 */
export function upload(
  store: Store,
  input: string,
  options: { strategy: Strategy; keyed: boolean },
): { store: Store; report: Report } {
  const { strategy, keyed } = options;
  const parsed = parseCsv(input);
  const { fileError, rows } = checkFile(parsed, keyed);
  const base = { strategy, inserted: 0, updated: 0, fileError, unchecked: 0 };

  if (fileError) {
    return { store, report: { ...base, committed: false, errors: [], rejectedRows: 0 } };
  }

  const bad = rows.filter((r) => r.errors.length > 0);

  if (strategy === 'rollback') {
    const firstBad = rows.findIndex((r) => r.errors.length > 0);
    if (firstBad >= 0) {
      return {
        store,
        report: {
          ...base,
          committed: false,
          errors: rows[firstBad].errors,
          rejectedRows: 1,
          unchecked: rows.length - firstBad - 1,
        },
      };
    }
  }

  if (strategy === 'dry-run' && bad.length > 0) {
    return {
      store,
      report: {
        ...base,
        committed: false,
        errors: bad.flatMap((r) => r.errors),
        rejectedRows: bad.length,
      },
    };
  }

  let next = store;
  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    if (!r.value) continue;
    const applied = applyRow(next, r.value, keyed);
    next = applied.store;
    if (applied.kind === 'inserted') inserted += 1;
    else updated += 1;
  }

  return {
    store: next,
    report: {
      ...base,
      committed: true,
      inserted,
      updated,
      errors: strategy === 'partial' ? bad.flatMap((r) => r.errors) : [],
      rejectedRows: strategy === 'partial' ? bad.length : 0,
    },
  };
}

/** 스프레드시트가 수식으로 읽는 첫 글자 (OWASP 목록) */
const FORMULA_START = /^[=+\-@\t\r\n]/;

/**
 * 내보내는 칸 하나를 CSV 안전한 문자열로 만들어요. 큰따옴표로 감싸고 안의 따옴표는 두 번 써요.
 * 수식으로 읽힐 수 있는 첫 글자 앞에는 탭을 붙여요. OWASP 가 Excel 에서 확인된 방식으로 권하는 처리예요.
 */
export function escapeCsvCell(value: string): string {
  const guarded = FORMULA_START.test(value) ? `\t${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export const SAMPLE_CSV = [
  'sku,name,price,stock',
  'A-100,머그컵,12000,30',
  'A-101,접시,,12',
  'A-102,"큰 냄비, 스테인리스",45000,-3',
  'A-103,"잔 ""특별판""",8000,5',
  'A-100,머그컵 중복,12000,4',
  'A-104,양초,abc,7',
].join('\r\n');
