import { Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ORDER_LABEL,
  ORDERS,
  type Order,
  STRATEGIES,
  STRATEGY_LABEL,
  type Strategy,
  type Status,
  simulate,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  none: '조건을 보내지 않아요. 마지막에 도착한 저장이 그대로 남아요.',
  'if-match': '읽은 ETag를 If-Match로 보내요. 서버 값과 다르면 412로 거절해요.',
  version: '읽은 버전을 WHERE 조건에 넣어요. 영향받은 행이 0이면 409로 거절해요.',
};

const STATUS_TEXT: Record<Status, string> = {
  200: '저장됨',
  409: '충돌 (버전 불일치)',
  412: '조건 불일치 (ETag 불일치)',
  428: '조건 헤더 필요',
};

const USER_NAME: Record<'A' | 'B', string> = { A: 'A', B: 'B' };

export default function Simulator() {
  const [strategy, setStrategy] = useState<Strategy>('none');
  const [order, setOrder] = useState<Order>('a-first');
  const [requireIfMatch, setRequireIfMatch] = useState(false);
  const [omitIfMatchB, setOmitIfMatchB] = useState(false);

  const ifMatch = strategy === 'if-match';
  const result = simulate({
    strategy,
    order,
    requireIfMatch: ifMatch && requireIfMatch,
    omitIfMatchB: ifMatch && omitIfMatchB,
  });
  const saveAt = new Map(result.saves.map((s) => [s.step, s]));

  return (
    <div className="ce-lab">
      <RadioGroup
        label="저장 전략"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="ce-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <RadioGroup
        label="두 사람의 읽기와 저장 순서"
        options={ORDERS.map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
        value={order}
        onValueChange={setOrder}
      />

      <div className="ce-lab__options">
        <Checkbox
          label="If-Match 없는 저장을 428로 거절"
          checked={requireIfMatch}
          disabled={!ifMatch}
          onCheckedChange={(v) => setRequireIfMatch(v === true)}
        />
        <Checkbox
          label="B 의 저장이 If-Match 를 빠뜨림 (FE 버그 흉내)"
          checked={omitIfMatchB}
          disabled={!ifMatch}
          onCheckedChange={(v) => setOmitIfMatchB(v === true)}
        />
      </div>

      <section className="ce-lab__results" aria-label="결과">
        <Stat label="최종 본문" value={result.finalBody} />
        <Stat label="최종 버전" value={result.finalVersion} />
        <Stat label="덮어쓴 저장" value={result.lost} unit="건" tone={result.lost > 0 ? 'accent' : 'ink'} />
        <Stat label="충돌 응답" value={result.conflicts} unit="건" />
      </section>

      {result.lost > 0 && (
        <p className="ce-lab__alarm" role="status">
          앞 사람이 읽은 뒤 고친 값을 나중 저장이 덮었어요. 앞 수정 한 건이 사라졌어요.
        </p>
      )}

      <table className="ce-table">
        <caption>요청 순서와 각 응답</caption>
        <thead>
          <tr>
            <th scope="col">순서</th>
            <th scope="col">사용자</th>
            <th scope="col">동작</th>
            <th scope="col">보낸 조건</th>
            <th scope="col">응답</th>
          </tr>
        </thead>
        <tbody>
          {result.steps.map((step) => {
            const save = saveAt.get(step.index);
            return (
              <tr key={step.index}>
                <td>{step.index + 1}</td>
                <td>{USER_NAME[step.user]}</td>
                <td>{step.kind === 'read' ? `읽기 (버전 ${step.seen})` : '저장'}</td>
                <td>{save ? <code>{save.sent}</code> : '—'}</td>
                <td>
                  {save ? (
                    <>
                      <code>{save.status}</code> {STATUS_TEXT[save.status]}
                      {save.stale && <Tag variant="accent">덮어씀</Tag>}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ce-lab__note">
        {strategy === 'none'
          ? '조건이 없으면 충돌을 알 수 없어요. 모든 저장이 200으로 통과해요.'
          : '충돌한 쪽은 재시도하기 전에 다시 읽어야 해요. 다시 읽으면 그 뒤 저장은 새 버전을 기준으로 해요.'}
      </p>
    </div>
  );
}
