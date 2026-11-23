import { Alert, Button, RadioGroup, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  advance,
  createRun,
  describeStep,
  getPreset,
  isFinished,
  PRESETS,
  ROW_IDS,
  ROW_LABEL,
  TX_ORDER,
  waitEdges,
  type LogKind,
  type Outcome,
  type PresetId,
  type RunState,
  type Tx,
  type TxId,
  type WaitEdge,
} from './model';
import './Simulator.css';

const OUTCOME_LABEL: Record<Outcome, string> = {
  committed: '커밋됨',
  deadlock: '데드락으로 중단',
  conflict: '409 충돌로 롤백',
  rejected: '조건 불충족으로 거절',
};

const ALERT_TITLE: Partial<Record<LogKind, string>> = {
  deadlock: '데드락을 감지해 한 트랜잭션을 중단했어요',
  conflict: '버전이 바뀌어 저장이 충돌했어요 (409)',
  rejected: '조건을 만족하지 않아 저장이 거절됐어요',
};

const NODE: Record<TxId, { x: number; y: number }> = { A: { x: 60, y: 60 }, B: { x: 220, y: 60 } };

function statusOf(tx: Tx): { label: string; variant: 'accent' | 'neutral' | 'outline' } {
  if (tx.status === 'waiting') return { label: `${ROW_LABEL[tx.waitingFor ?? 'stock']} 락 대기`, variant: 'accent' };
  if (tx.status === 'committed') return { label: OUTCOME_LABEL.committed, variant: 'outline' };
  if (tx.status === 'aborted') return { label: OUTCOME_LABEL[tx.outcome ?? 'rejected'], variant: 'accent' };
  return { label: '실행 중', variant: 'neutral' };
}

function seenText(tx: Tx): string {
  const parts = ROW_IDS.flatMap((row) => {
    const seen = tx.snapshot[row];
    return seen ? [`${ROW_LABEL[row]} ${seen.value} (v${seen.version})`] : [];
  });
  return parts.length > 0 ? `읽은 값: ${parts.join(', ')}` : '아직 읽은 값이 없어요';
}

function TxCard({ tx, onStep }: { tx: Tx; onStep: () => void }) {
  const finished = isFinished(tx);
  const status = statusOf(tx);
  return (
    <section className="tx-card" aria-labelledby={`tx-card-${tx.id}`}>
      <header className="tx-card__head">
        <h3 id={`tx-card-${tx.id}`}>트랜잭션 {tx.id}</h3>
        <Tag variant={status.variant}>{status.label}</Tag>
      </header>
      <ol className="tx-card__steps">
        {tx.script.map((step, i) => {
          const current = i === tx.pc && !finished;
          const state = i < tx.pc ? 'done' : current ? 'next' : 'todo';
          return (
            <li key={i} data-state={state} aria-current={current ? 'step' : undefined}>
              <code>{describeStep(step)}</code>
            </li>
          );
        })}
      </ol>
      <p className="tx-card__seen">{seenText(tx)}</p>
      <Button variant="secondary" size="sm" onClick={onStep} disabled={finished}>
        {tx.id} 한 걸음 진행
      </Button>
    </section>
  );
}

function WaitGraph({ edges }: { edges: WaitEdge[] }) {
  const cyclic = edges.length === 2;
  return (
    <div className="tx-graph-wrap">
      <svg
        className={cyclic ? 'tx-graph tx-graph--cycle' : 'tx-graph'}
        viewBox="0 0 280 120"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <marker id="tx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path className="tx-graph__arrow" d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>
        {edges.map((e) => (
          <g key={`${e.from}-${e.to}`}>
            <path
              className="tx-graph__edge"
              d={e.from === 'A' ? 'M82,52 Q140,8 198,52' : 'M198,68 Q140,112 82,68'}
              markerEnd="url(#tx-arrow)"
            />
            <text className="tx-graph__label" x="140" y={e.from === 'A' ? 22 : 104} textAnchor="middle">
              {ROW_LABEL[e.row]}
            </text>
          </g>
        ))}
        {TX_ORDER.map((id) => (
          <g key={id}>
            <circle className="tx-graph__node" cx={NODE[id].x} cy={NODE[id].y} r="22" />
            <text
              className="tx-graph__name"
              x={NODE[id].x}
              y={NODE[id].y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {id}
            </text>
          </g>
        ))}
      </svg>
      {edges.length === 0 ? (
        <p className="tx-graph__text">기다리는 관계가 없어요.</p>
      ) : (
        <ul className="tx-graph__text">
          {edges.map((e) => (
            <li key={`${e.from}-${e.to}`}>
              {e.from} 가 {e.to} 를 기다려요 ({ROW_LABEL[e.row]} 락)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DataTable({ run }: { run: RunState }) {
  return (
    <table className="tx-table">
      <caption>데이터와 락 (커밋된 상태)</caption>
      <thead>
        <tr>
          <th scope="col">행</th>
          <th scope="col">값</th>
          <th scope="col">version</th>
          <th scope="col">락 보유</th>
        </tr>
      </thead>
      <tbody>
        {ROW_IDS.map((row) => (
          <tr key={row}>
            <th scope="row">
              {ROW_LABEL[row]} <code>{row}</code>
            </th>
            <td>{run.rows[row].value}</td>
            <td>{run.rows[row].version}</td>
            <td>{run.locks[row] ?? '없음'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Simulator() {
  const [presetId, setPresetId] = useState<PresetId>(PRESETS[0].id);
  const [run, setRun] = useState<RunState>(() => createRun(getPreset(PRESETS[0].id)));
  const preset = getPreset(presetId);

  const choose = (id: PresetId) => {
    setPresetId(id);
    setRun(createRun(getPreset(id)));
  };
  const stepTx = (id: TxId) => setRun((state) => advance(state, id));
  const reset = () => setRun(createRun(preset));

  const narration = run.log.at(-1);
  const alert = run.log.findLast((entry) => ALERT_TITLE[entry.kind] !== undefined);
  const alertTitle = alert ? ALERT_TITLE[alert.kind] : undefined;

  return (
    <div className="tx-lab">
      <RadioGroup
        label="시나리오"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choose}
      />
      <p className="tx-lab__summary">{preset.summary}</p>
      <p className="tx-lab__schedule">
        추천 순서 <code>{preset.schedule.join(' → ')}</code>
      </p>

      <div className="tx-lab__txs">
        {TX_ORDER.map((id) => (
          <TxCard key={id} tx={run.txs[id]} onStep={() => stepTx(id)} />
        ))}
      </div>

      <p className="tx-lab__narration" aria-live="polite">
        {narration?.text ?? '트랜잭션 버튼을 눌러 한 단계씩 진행해 보세요.'}
      </p>

      {alertTitle && <Alert tone="warning" title={alertTitle} />}

      <div className="tx-lab__panels">
        <DataTable run={run} />
        <section className="tx-lab__graph" aria-labelledby="tx-graph-title">
          <h3 id="tx-graph-title">대기 관계</h3>
          <WaitGraph edges={waitEdges(run)} />
        </section>
      </div>

      <section className="tx-lab__log" aria-labelledby="tx-log-title">
        <h3 id="tx-log-title">진행 기록</h3>
        {run.log.length === 0 ? (
          <p>아직 기록이 없어요.</p>
        ) : (
          <ol>
            {run.log.map((entry, i) => (
              <li key={i}>
                <strong>{entry.tx}</strong> {entry.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="tx-lab__actions">
        <Button variant="ghost" size="sm" onClick={reset}>
          처음부터 다시
        </Button>
      </div>
    </div>
  );
}
