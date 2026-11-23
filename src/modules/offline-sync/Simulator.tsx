import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  type Device,
  FIELD_LABEL,
  NOTE_LABEL,
  ORDER_LABEL,
  ORDERS,
  type Order,
  PAYLOAD_LABEL,
  PAYLOADS,
  type Payload,
  STRATEGIES,
  STRATEGY_HINT,
  STRATEGY_LABEL,
  type Strategy,
  simulate,
} from './model';
import './Simulator.css';

const DEVICE_LABEL: Record<Device, string> = { phone: '폰', laptop: '노트북' };

export default function Simulator() {
  const [order, setOrder] = useState<Order>('laptop-first');
  const [payload, setPayload] = useState<Payload>('patch');
  const [strategy, setStrategy] = useState<Strategy>('lww');

  const result = simulate({ order, payload, strategy });
  const lostCount = result.lost.length;

  return (
    <div className="ob-lab">
      <RadioGroup
        label="도착 순서"
        options={ORDERS.map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
        value={order}
        onValueChange={setOrder}
      />
      <RadioGroup
        label="전송 범위"
        options={PAYLOADS.map((p) => ({ value: p, label: PAYLOAD_LABEL[p] }))}
        value={payload}
        onValueChange={setPayload}
      />
      <RadioGroup
        label="충돌 전략"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="ob-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <section className="ob-lab__results" aria-label="결과">
        <Stat label="최종 제목" value={result.final.title} />
        <Stat label="최종 본문" value={result.final.body} />
        <Stat label="잃은 변경" value={lostCount} unit="건" tone={lostCount > 0 ? 'accent' : 'ink'} />
        <Stat label="보류 중 충돌" value={result.pending.length} unit="건" />
      </section>

      {lostCount > 0 && (
        <p className="ob-lab__alarm" role="status">
          기기 한 대의 편집이 사라졌어요. 잃은 값은{' '}
          {result.lost.map((l) => `${DEVICE_LABEL[l.device]}의 ${FIELD_LABEL[l.field]} "${l.value}"`).join(', ')}이에요.
        </p>
      )}

      <table className="ob-table">
        <caption>대기열 전송 순서와 서버 응답</caption>
        <thead>
          <tr>
            <th scope="col">순서</th>
            <th scope="col">기기</th>
            <th scope="col">편집</th>
            <th scope="col">보낸 필드</th>
            <th scope="col">응답</th>
          </tr>
        </thead>
        <tbody>
          {result.writes.map((w, i) => (
            <tr key={w.id}>
              <td>{i + 1}</td>
              <td>{DEVICE_LABEL[w.device]}</td>
              <td>{w.edit}</td>
              <td>{w.sent.map((f) => FIELD_LABEL[f]).join(', ')}</td>
              <td>
                <code>{w.status}</code>{' '}
                {w.notes.map((n, j) => (
                  <Tag key={j} variant={n === 'overwrote' || n === 'overwrote-changed' ? 'accent' : 'neutral'}>
                    {NOTE_LABEL[n]}
                  </Tag>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="ob-table ob-table--views">
        <caption>기기별 화면에 남은 값</caption>
        <thead>
          <tr>
            <th scope="col">화면</th>
            <th scope="col">제목</th>
            <th scope="col">본문</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">서버</th>
            <td>{result.final.title}</td>
            <td>{result.final.body}</td>
          </tr>
          <tr>
            <th scope="row">폰</th>
            <td>{result.phoneView.title}</td>
            <td>{result.phoneView.body}</td>
          </tr>
          <tr>
            <th scope="row">노트북</th>
            <td>{result.laptopView.title}</td>
            <td>{result.laptopView.body}</td>
          </tr>
        </tbody>
      </table>

      <p className="ob-lab__note">
        이 모델은 실제 서버 구현이 아니라 전략을 비교하려고 단순화한 것이에요. 기준 버전은 두 기기 모두 처음 받은 버전
        하나로 가정해요.
      </p>
    </div>
  );
}
