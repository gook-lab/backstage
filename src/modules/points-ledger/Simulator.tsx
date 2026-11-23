import { Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DAY_MAX,
  EXPIRY_POLICIES,
  EXPIRY_POLICY_LABEL,
  EXTEND_DAYS,
  type ExpiryPolicy,
  LOT_IDS,
  type RowKind,
  simulate,
} from './model';
import './Simulator.css';

const KIND_LABEL: Record<RowKind, string> = {
  earn: '적립',
  use: '사용',
  restore: '복원',
  expire: '소멸',
  extend: '유효기간 연장',
};

const POLICY_HINT: Record<ExpiryPolicy, string> = {
  none: '취소된 몫이 이미 만료된 묶음의 것이면 돌려주지 않아요. 사용자는 그만큼 손해를 봐요.',
  'restore-expire': '돌려주되 바로 소멸시켜요. 잔액은 변하지 않지만, 원장에 복원과 소멸이 모두 남아요.',
  extend: `돌려주고 취소한 날부터 ${EXTEND_DAYS}일 동안 다시 쓸 수 있어요. 기간은 예시 값이에요.`,
};

const fmt = (n: number) => n.toLocaleString('ko-KR');

interface LotState {
  amount: number;
  expiresDay: number;
}

const INITIAL_LOTS: Record<(typeof LOT_IDS)[number], LotState> = {
  A: { amount: 3000, expiresDay: 30 },
  B: { amount: 5000, expiresDay: 60 },
  C: { amount: 4000, expiresDay: 90 },
};

export default function Simulator() {
  const [lots, setLots] = useState(INITIAL_LOTS);
  const [useAmount, setUseAmount] = useState(6000);
  const [useDay, setUseDay] = useState(40);
  const [cancel, setCancel] = useState(true);
  const [cancelDay, setCancelDay] = useState(70);
  const [policy, setPolicy] = useState<ExpiryPolicy>('none');
  const [viewDay, setViewDay] = useState(75);

  const effectiveCancelDay = Math.max(cancelDay, useDay);
  const result = simulate({
    lots: LOT_IDS.map((id) => ({ id, ...lots[id] })),
    useAmount,
    useDay,
    cancel,
    cancelDay: effectiveCancelDay,
    policy,
    viewDay,
  });

  const patchLot = (id: (typeof LOT_IDS)[number], patch: Partial<LotState>) =>
    setLots((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const allocatedBy = (id: string) => result.allocations.find((a) => a.lotId === id)?.amount ?? 0;

  return (
    <div className="pl-lab">
      <fieldset className="pl-group">
        <legend>적립 묶음 3개</legend>
        <div className="pl-lots">
          {LOT_IDS.map((id) => (
            <div className="pl-lot" key={id}>
              <strong>묶음 {id}</strong>
              <label className="pl-field">
                <span>적립 {fmt(lots[id].amount)}P</span>
                <input
                  type="range"
                  aria-label={`${id} 적립 금액`}
                  min={0}
                  max={10000}
                  step={500}
                  value={lots[id].amount}
                  onChange={(e) => patchLot(id, { amount: Number(e.target.value) })}
                />
              </label>
              <label className="pl-field">
                <span>만료 {lots[id].expiresDay}일째 (이날까지 사용 가능)</span>
                <input
                  type="range"
                  aria-label={`${id} 만료일`}
                  min={10}
                  max={120}
                  step={1}
                  value={lots[id].expiresDay}
                  onChange={(e) => patchLot(id, { expiresDay: Number(e.target.value) })}
                />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="pl-controls">
        <label className="pl-field">
          <span>사용 {fmt(useAmount)}P</span>
          <input
            type="range"
            aria-label="사용 금액"
            min={500}
            max={12000}
            step={500}
            value={useAmount}
            onChange={(e) => setUseAmount(Number(e.target.value))}
          />
        </label>
        <label className="pl-field">
          <span>사용 {useDay}일째</span>
          <input
            type="range"
            aria-label="사용 날짜"
            min={1}
            max={120}
            step={1}
            value={useDay}
            onChange={(e) => setUseDay(Number(e.target.value))}
          />
        </label>
        <label className="pl-field">
          <span>
            취소 {effectiveCancelDay}일째{!cancel && ' (취소하지 않음)'}
          </span>
          <input
            type="range"
            aria-label="취소 날짜"
            min={useDay}
            max={120}
            step={1}
            value={effectiveCancelDay}
            disabled={!cancel}
            onChange={(e) => setCancelDay(Number(e.target.value))}
          />
        </label>
        <label className="pl-field">
          <span>확인 {viewDay}일째 기준 잔액</span>
          <input
            type="range"
            aria-label="확인 날짜"
            min={0}
            max={DAY_MAX}
            step={1}
            value={viewDay}
            onChange={(e) => setViewDay(Number(e.target.value))}
          />
        </label>
      </div>

      <Checkbox
        label="사용을 취소해요"
        hint="취소는 사용 전체를 되돌리는 거래예요. 기록은 지우지 않고 복원 행을 더해요."
        checked={cancel}
        onCheckedChange={(checked) => setCancel(checked === true)}
      />

      <RadioGroup
        label="만료된 묶음 몫을 취소할 때 (예시 정책)"
        options={EXPIRY_POLICIES.map((p) => ({ value: p, label: EXPIRY_POLICY_LABEL[p] }))}
        value={policy}
        onValueChange={setPolicy}
      />
      <p className="pl-hint">{POLICY_HINT[policy]}</p>

      <section className="pl-results" aria-label="결과">
        <Stat label="남은 잔액" value={fmt(result.balanceAt)} unit="P" />
        <Stat label="만료로 소멸" value={fmt(result.expiredAt)} unit="P" />
        <Stat label="복원하지 않은 금액" value={fmt(result.notRestoredAt)} unit="P" />
        <Stat
          label="사용 배분"
          value={
            result.insufficient
              ? '없음'
              : result.allocations.map((a) => `${a.lotId} ${fmt(a.amount)}`).join(' · ') || '없음'
          }
        />
      </section>

      {result.insufficient && (
        <p className="pl-alarm" role="status">
          사용할 수 있는 포인트가 {fmt(result.shortBy)}P 부족해요. 사용 금액을 낮추거나 사용 날짜를 바꿔 보세요.
        </p>
      )}

      <table className="pl-table">
        <caption>묶음별 잔액 ({viewDay}일째 기준)</caption>
        <thead>
          <tr>
            <th scope="col">묶음</th>
            <th scope="col">적립</th>
            <th scope="col">사용 배분</th>
            <th scope="col">잔액</th>
          </tr>
        </thead>
        <tbody>
          {LOT_IDS.map((id) => (
            <tr key={id}>
              <th scope="row">
                {id} (만료 {lots[id].expiresDay}일째)
              </th>
              <td>{fmt(lots[id].amount)}</td>
              <td>{fmt(allocatedBy(id))}</td>
              <td>{fmt(result.lotBalanceAt[id] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="pl-table pl-ledger">
        <caption>원장 행 (날짜 순)</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">종류</th>
            <th scope="col">묶음</th>
            <th scope="col">변화</th>
            <th scope="col">잔액</th>
          </tr>
        </thead>
        <tbody>
          {result.ledger.map((row, i) => (
            <tr key={i} className={row.day > viewDay ? 'pl-ledger__future' : undefined}>
              <td>{row.day}일째</td>
              <td>{KIND_LABEL[row.kind]}</td>
              <td>{row.lotId}</td>
              <td>{row.amount > 0 ? `+${fmt(row.amount)}` : row.amount < 0 ? `−${fmt(-row.amount)}` : '0'}</td>
              <td>{fmt(row.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pl-note">
        잔액은 {viewDay}일째까지의 원장 행을 더한 값이에요. 흐린 행은 아직 일어나지 않은 날이에요. 수치는 감을 잡기 위한
        예시예요.
      </p>
    </div>
  );
}
