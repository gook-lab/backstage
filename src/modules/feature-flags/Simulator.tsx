import { RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { type Assignment, countFlipUsers, MAX_LAG, type Mode, simulate, USER_COUNT, VISITS } from './model';
import './Simulator.css';

const MODE_OPTIONS: readonly { value: Mode; label: string; hint: string }[] = [
  {
    value: 'server',
    label: '서버 평가',
    hint: '서버가 값을 정하고, 화면은 서버 응답을 따라요. 캐시 지연은 서버에 있어요.',
  },
  {
    value: 'client',
    label: '클라이언트 평가',
    hint: '화면이 값을 정하고, 서버는 요청에 실린 값을 그대로 따라요. 캐시 지연은 화면에 있어요.',
  },
  { value: 'both', label: '둘 다 각자', hint: '화면은 매번 최신 값을 보고, 서버는 캐시된 값으로 판단해요.' },
];

const ASSIGN_OPTIONS: readonly { value: Assignment; label: string }[] = [
  { value: 'hash', label: '사용자 id 해시' },
  { value: 'random', label: '매번 무작위' },
];

export default function Simulator() {
  const [ratio, setRatio] = useState(5);
  const [lag, setLag] = useState(0);
  const [mode, setMode] = useState<Mode>('server');
  const [assignment, setAssignment] = useState<Assignment>('hash');

  const result = useMemo(() => simulate({ ratio, lag, mode, assignment }), [ratio, lag, mode, assignment]);
  const flips = useMemo(
    () => ({ hash: countFlipUsers('hash', ratio), random: countFlipUsers('random', ratio) }),
    [ratio],
  );

  const mismatch = result.mismatchRequests > 0;
  const modeHint = MODE_OPTIONS.find((o) => o.value === mode)?.hint;

  const reasons: string[] = [];
  if (mode === 'server')
    reasons.push('서버가 정한 값을 화면이 그대로 따라요. 이 방식에서는 화면과 서버가 어긋나지 않아요.');
  if (mode === 'client')
    reasons.push('화면이 정한 값을 서버가 따라요. 어긋남은 없지만, 돈이 걸린 분기를 클라이언트 값에 맡기게 돼요.');
  if (mode === 'both')
    reasons.push('화면은 새 규칙을, 서버는 옛 규칙을 볼 수 있어요. 이때 화면과 서버가 서로 다른 결제 흐름을 타요.');
  if (assignment === 'hash') reasons.push('사용자 id 해시는 같은 사용자에게 방문마다 같은 결과를 줘요.');
  if (assignment === 'random')
    reasons.push('무작위 배정은 같은 사용자도 방문마다 다른 결과를 받아요. 실험 집단이 섞여요.');

  return (
    <div className="ff-lab">
      <RadioGroup
        label="평가 위치"
        options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
      />
      {modeHint && <p className="ff-lab__hint">{modeHint}</p>}

      <RadioGroup
        label="배정 방식"
        options={ASSIGN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={assignment}
        onValueChange={(v) => setAssignment(v as Assignment)}
      />

      <div className="ff-lab__sliders">
        <label className="ff-lab__slider">
          <span>출시 비율 · {ratio}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
          />
        </label>
        <label className="ff-lab__slider">
          <span>
            {mode === 'client' ? '화면' : '서버'} 플래그 캐시 지연 · {lag}번 방문 뒤 반영
          </span>
          <input
            type="range"
            min={0}
            max={MAX_LAG}
            step={1}
            value={lag}
            onChange={(e) => setLag(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="ff-lab__result" aria-label="결과">
        <p className="ff-lab__verdict" data-state={mismatch ? 'mismatch' : 'ok'}>
          {mismatch ? '화면과 서버가 서로 다른 값을 본 요청이 있어요' : '화면과 서버가 어긋난 요청이 없어요'}
        </p>

        <dl className="ff-lab__stats">
          <div>
            <dt>노출 사용자 수</dt>
            <dd>
              {result.exposedUsers.toLocaleString('ko-KR')}명 / {USER_COUNT.toLocaleString('ko-KR')}명
            </dd>
          </div>
          <div>
            <dt>노출 요청 수</dt>
            <dd>
              {result.exposedRequests.toLocaleString('ko-KR')}회 / {result.totalRequests.toLocaleString('ko-KR')}회
            </dd>
          </div>
          <div>
            <dt>화면과 서버가 다른 값을 본 요청</dt>
            <dd>
              {result.mismatchRequests.toLocaleString('ko-KR')}회 / {result.totalRequests.toLocaleString('ko-KR')}회
            </dd>
          </div>
        </dl>

        <ol className="ff-lab__reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>

        <table className="ff-lab__flip">
          <caption>같은 출시 비율에서 방문 {VISITS}번 중 결과가 바뀐 사용자 (캐시 지연과 무관)</caption>
          <thead>
            <tr>
              <th scope="col">배정 방식</th>
              <th scope="col">결과가 바뀐 사용자</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">사용자 id 해시</th>
              <td>{flips.hash.toLocaleString('ko-KR')}명</td>
            </tr>
            <tr>
              <th scope="row">매번 무작위</th>
              <td>{flips.random.toLocaleString('ko-KR')}명</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="ff-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
