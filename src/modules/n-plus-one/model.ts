export type Strategy = 'n-plus-one' | 'join' | 'in-batch';

export interface LabConfig {
  strategy: Strategy;
  /** 목록에 보여 줄 글 수 */
  listSize: number;
  /** DB 한 번 왕복하는 시간 (ms, 예시) */
  latencyMs: number;
  /** IN 으로 한 번에 묶어 조회할 글 수 */
  batchSize: number;
  /** comments.post_id 인덱스 사용 여부 */
  indexed: boolean;
}

/** 아래 상수는 모두 설명용 예시 값이에요. 실제 DB 측정치가 아니에요. */
export const COMMENTS_PER_POST = 3;
export const COMMENT_TABLE_ROWS = 100_000;
export const ROW_COST_MS = 0.001;
export const INDEX_PROBE_ROWS = 3;

export interface QueryLogItem {
  label: string;
  sql: string;
  rowsScanned: number;
  ms: number;
}

export interface LabResult {
  queries: number;
  rowsScanned: number;
  estimatedMs: number;
  log: QueryLogItem[];
}

const lookupRows = (indexed: boolean, keys: number): number =>
  indexed ? keys * (COMMENTS_PER_POST + INDEX_PROBE_ROWS) : COMMENT_TABLE_ROWS;

const listSql = (n: number) => `SELECT id, title FROM posts ORDER BY id LIMIT ${n};`;

export function runLab({ strategy, listSize: n, latencyMs, batchSize, indexed }: LabConfig): LabResult {
  const size = Math.max(1, Math.floor(n));
  const batch = Math.max(1, Math.floor(batchSize));
  const log: QueryLogItem[] = [];

  const push = (label: string, sql: string, rowsScanned: number) => {
    log.push({ label, sql, rowsScanned, ms: latencyMs + rowsScanned * ROW_COST_MS });
  };

  if (strategy === 'join') {
    push(
      'JOIN 한 번',
      `SELECT p.id, p.title, c.id, c.body FROM (SELECT id, title FROM posts ORDER BY id LIMIT ${size}) p LEFT JOIN comments c ON c.post_id = p.id;`,
      size + lookupRows(indexed, size),
    );
  } else {
    push('글 목록', listSql(size), size);

    if (strategy === 'n-plus-one') {
      for (let id = 1; id <= size; id += 1) {
        push(`글 ${id} 댓글`, `SELECT id, body FROM comments WHERE post_id = ${id};`, lookupRows(indexed, 1));
      }
    } else {
      for (let start = 1; start <= size; start += batch) {
        const end = Math.min(size, start + batch - 1);
        const keys = end - start + 1;
        const ids = Array.from({ length: keys }, (_, i) => start + i).join(', ');
        push(
          `글 ${start}~${end} 댓글 묶음`,
          `SELECT id, body, post_id FROM comments WHERE post_id IN (${ids});`,
          lookupRows(indexed, keys),
        );
      }
    }
  }

  const rowsScanned = log.reduce((sum, item) => sum + item.rowsScanned, 0);
  const estimatedMs = log.reduce((sum, item) => sum + item.ms, 0);
  return { queries: log.length, rowsScanned, estimatedMs, log };
}
