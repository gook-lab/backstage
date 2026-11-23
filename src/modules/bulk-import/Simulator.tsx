import { Alert, Button, Checkbox, RadioGroup, Textarea } from '@gook-lab/ui';
import { useState } from 'react';
import {
  EMPTY_STORE,
  type Report,
  SAMPLE_CSV,
  STRATEGIES,
  STRATEGY_LABEL,
  type Store,
  type Strategy,
  upload,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  rollback: '한 트랜잭션으로 보고 첫 오류에서 멈춘 뒤 전부 되돌려요.',
  partial: '행마다 따로 확정해요. 맞는 행은 저장되고, 틀린 행은 오류와 함께 남아요.',
  'dry-run': '저장 없이 전체를 검사해요. 오류가 하나도 없을 때만 저장해요.',
};

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('partial');
  const [keyed, setKeyed] = useState(true);
  const [text, setText] = useState(SAMPLE_CSV);
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [report, setReport] = useState<Report | null>(null);

  const run = () => {
    const next = upload(store, text, { strategy, keyed });
    setStore(next.store);
    setReport(next.report);
  };

  const clear = () => {
    setStore(EMPTY_STORE);
    setReport(null);
  };

  const skuCounts = new Map<string, number>();
  for (const r of store.rows) skuCounts.set(r.sku, (skuCounts.get(r.sku) ?? 0) + 1);
  const duplicated = [...skuCounts].filter(([, n]) => n > 1).map(([sku]) => sku);

  return (
    <div className="bi-lab">
      <RadioGroup
        label="처리 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={(v) => setStrategy(v as Strategy)}
      />
      <p className="bi-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <Checkbox
        label="sku 를 업서트 키로 쓰기"
        hint="같은 sku 가 오면 새로 넣지 않고 기존 행을 고쳐요. 끄면 올릴 때마다 행이 늘어요."
        checked={keyed}
        onCheckedChange={(checked) => setKeyed(checked === true)}
      />

      <Textarea
        label="CSV 내용"
        helper="직접 고쳐서 다시 올려 보세요. 행 번호는 엑셀처럼 헤더가 1행이에요."
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="bi-lab__actions">
        <Button onClick={run}>{report ? '다시 올리기' : '올리기'}</Button>
        <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE_CSV)}>
          예시 CSV 로 되돌리기
        </Button>
        <Button variant="ghost" size="sm" onClick={clear}>
          저장 내용 비우기
        </Button>
      </div>

      <section className="bi-lab__result" aria-label="처리 결과">
        {report === null ? (
          <p className="bi-lab__hint">올리기를 누르면 저장된 행과 거절된 행을 보여 줘요.</p>
        ) : report.fileError ? (
          <Alert tone="error" title="파일을 읽지 못했어요">
            {`${report.fileError}. 행은 하나도 처리하지 않았어요.`}
          </Alert>
        ) : (
          <>
            <p className="bi-lab__verdict" data-committed={report.committed}>
              {report.committed
                ? `저장 ${report.inserted + report.updated}행 · 거절 ${report.rejectedRows}행`
                : '확정되지 않았어요. 아무 행도 저장하지 않았어요.'}
            </p>
            {report.committed && (
              <p className="bi-lab__hint">
                새로 넣은 행 {report.inserted} · 고쳐 쓴 행 {report.updated}
              </p>
            )}
            {report.unchecked > 0 && (
              <p className="bi-lab__hint">첫 오류에서 멈춰서 나머지 {report.unchecked}행은 확인하지 않았어요.</p>
            )}

            {report.errors.length > 0 && (
              <table className="bi-lab__errors">
                <thead>
                  <tr>
                    <th scope="col">행</th>
                    <th scope="col">열</th>
                    <th scope="col">이유</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((e, i) => (
                    <tr key={`${e.row}-${e.column}-${i}`}>
                      <td>{e.row}</td>
                      <td>{e.column}</td>
                      <td>{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        <div className="bi-lab__stored">
          <h3>저장된 행 {store.rows.length}개</h3>
          {duplicated.length > 0 && (
            <p className="bi-lab__hint">
              같은 sku 가 여러 번 저장됐어요: {duplicated.join(', ')}. 업서트 키를 켜면 한 번만 남아요.
            </p>
          )}
          {store.rows.length === 0 ? (
            <p className="bi-lab__hint">아직 저장된 행이 없어요.</p>
          ) : (
            <ul className="bi-lab__rows">
              {store.rows.map((r, i) => (
                <li key={`${r.sku}-${i}`}>
                  {r.sku} · {r.name} · {r.price.toLocaleString('ko-KR')}원 · 재고 {r.stock}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
