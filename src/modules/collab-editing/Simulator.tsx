import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ARRIVAL_LABEL,
  ARRIVALS,
  type Arrival,
  BASE,
  type ChangeStatus,
  changeStatus,
  COMBO_LABEL,
  COMBOS,
  type Combo,
  isConverged,
  METHOD_HINT,
  METHOD_LABEL,
  METHODS,
  type Method,
  type Op,
  runScene,
  SCENE,
  type Screens,
  type Who,
} from './model';
import './Simulator.css';

const describeOp = (op: Op): string => {
  if (op.kind === 'delete') return `"${BASE[op.at]}" 지우기`;
  const place = op.at === 0 ? '맨 앞에' : `${op.at}번째 글자 뒤에`;
  return `${place} "${op.text.trim()}" 넣기`;
};

const SCREEN_ROWS: readonly { key: keyof Screens; label: string }[] = [
  { key: 'server', label: '서버' },
  { key: 'a', label: 'A 화면' },
  { key: 'b', label: 'B 화면' },
];

export default function Simulator() {
  const [method, setMethod] = useState<Method>('overwrite');
  const [combo, setCombo] = useState<Combo>('same-insert');
  const [arrival, setArrival] = useState<Arrival>('a-first');

  const screens = runScene(method, combo, arrival);
  const converged = isConverged(screens);
  const scene = SCENE[combo];

  const cell = (doc: string, who: Who): ChangeStatus => changeStatus(doc, who, combo);

  return (
    <div className="cc-lab">
      <RadioGroup
        label="편집을 합치는 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="cc-lab__hint">{METHOD_HINT[method]}</p>

      <div className="cc-lab__controls">
        <RadioGroup
          label="동시에 보낸 연산"
          options={COMBOS.map((c) => ({ value: c, label: COMBO_LABEL[c] }))}
          value={combo}
          onValueChange={setCombo}
        />
        <RadioGroup
          label="서버에 먼저 도착한 쪽"
          options={ARRIVALS.map((a) => ({ value: a, label: ARRIVAL_LABEL[a] }))}
          value={arrival}
          onValueChange={setArrival}
        />
      </div>

      <p className="cc-lab__scene">
        기준 문서는 "{BASE}"예요. A는 {describeOp(scene.a)}, B는 {describeOp(scene.b)}를 보내요.
      </p>

      <section className="cc-lab__result" aria-label="결과">
        <table className="cc-lab__table">
          <thead>
            <tr>
              <th scope="col">화면</th>
              <th scope="col">최종 문자열</th>
              <th scope="col">A 변경</th>
              <th scope="col">B 변경</th>
            </tr>
          </thead>
          <tbody>
            {SCREEN_ROWS.map((row) => {
              const doc = screens[row.key];
              const a = cell(doc, 'A');
              const b = cell(doc, 'B');
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td className="cc-lab__doc">{doc}</td>
                  <td data-status={a}>{a}</td>
                  <td data-status={b}>{b}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="cc-lab__verdict" role="status" data-converged={converged}>
          {converged
            ? '두 화면과 서버의 문자열이 같아요.'
            : '두 화면이 서로 달라요. 같은 문서를 보고 있다고 말할 수 없어요.'}
        </p>
        <p className="cc-lab__hint">
          남음 · 깨짐 · 사라짐은 글을 넣은 변경이에요. 반영 · 안 지워짐 · 엉뚱한 글자 지워짐은 글자를 지운 변경이에요.
          깨짐은 첫 글자는 남았지만 글이 붙어 있지 않은 상태예요.
        </p>
      </section>

      <p className="cc-lab__note">단순화한 모델이에요. 네트워크 지연과 재전송은 다루지 않아요.</p>
    </div>
  );
}
