import { Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { type Kind, type Outcome, type Subscription, simulate } from './model';
import './Simulator.css';

const SEND_MAX = 40;
const TTL_MAX = 20;

const KIND_LABEL: Record<Kind, string> = {
  active: '연결됨',
  'device-off': '꺼짐',
  expired: '만료',
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  delivered: '바로 전달',
  'delivered-after-wait': '대기 후 전달',
  dropped: '버림',
  deleted: '구독 삭제 (404)',
};

const SERVER_ACTION: Record<Outcome, string> = {
  delivered: '구독 유지',
  'delivered-after-wait': '구독 유지',
  dropped: '구독 유지 · 알림함에서 확인',
  deleted: '구독 행 삭제',
};

function stateText(sub: Subscription): string {
  if (sub.kind === 'device-off') return `${KIND_LABEL[sub.kind]} · 틱 ${sub.reachableFrom}에 켜져요`;
  return KIND_LABEL[sub.kind];
}

export default function Simulator() {
  const [sendAt, setSendAt] = useState(10);
  const [ttl, setTtl] = useState(5);

  const result = simulate({ sendAt, ttl });

  return (
    <div className="pn-lab">
      <p className="pn-lab__hint">
        {ttl === 0
          ? 'TTL 0 이에요. 기기가 이미 연결된 때만 전달하고, 꺼진 기기는 그 자리에서 버려요.'
          : `TTL ${ttl} 틱 안에 기기가 켜지면 대기 후 전달하고, 켜지지 않으면 틱 ${sendAt + ttl}에 버려요.`}
      </p>

      <div className="pn-lab__controls">
        <label className="pn-field">
          <span>발송 시각 {sendAt} 틱</span>
          <input
            type="range"
            min={0}
            max={SEND_MAX}
            step={1}
            value={sendAt}
            onChange={(e) => setSendAt(Number(e.target.value))}
          />
        </label>
        <label className="pn-field">
          <span>TTL {ttl} 틱</span>
          <input
            type="range"
            min={0}
            max={TTL_MAX}
            step={1}
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="pn-lab__results" aria-label="결과 요약">
        <Stat label="바로 전달" value={result.counts.delivered} unit="개" />
        <Stat label="대기 후 전달" value={result.counts['delivered-after-wait']} unit="개" />
        <Stat
          label="버림"
          value={result.counts.dropped}
          unit="개"
          tone={result.counts.dropped > 0 ? 'accent' : 'ink'}
        />
        <Stat label="구독 삭제" value={result.counts.deleted} unit="개" />
      </section>

      <table className="pn-table">
        <caption>구독 네 개의 발송 결과</caption>
        <thead>
          <tr>
            <th scope="col">구독</th>
            <th scope="col">상태</th>
            <th scope="col">결과</th>
            <th scope="col">서버 할 일</th>
          </tr>
        </thead>
        <tbody>
          {result.verdicts.map((v) => (
            <tr key={v.subscription.id}>
              <th scope="row">{v.subscription.label}</th>
              <td>{stateText(v.subscription)}</td>
              <td>
                {OUTCOME_LABEL[v.outcome]}
                {v.at !== null && ` · 틱 ${v.at}`}
              </td>
              <td>{SERVER_ACTION[v.outcome]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pn-lab__note">
        발송 시각과 TTL은 시뮬레이터의 틱 단위예요. 실제 TTL은 초 단위예요. 수치는 감을 잡기 위한 예시예요.
      </p>
    </div>
  );
}
