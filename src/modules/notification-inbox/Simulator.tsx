import { Button, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ACTION_LABEL,
  ACTIONS,
  type Action,
  COUNT_MODE_LABEL,
  COUNT_MODES,
  type Config,
  COUNTER_WRITE_LABEL,
  COUNTER_WRITES,
  type CountMode,
  type CounterWrite,
  READ_MODE_LABEL,
  READ_MODES,
  type ReadMode,
  apply,
  badgeRows,
  badgeValue,
  createRun,
  type Run,
  trueUnread,
} from './model';
import './Simulator.css';

const READ_HINT: Record<ReadMode, string> = {
  flag: '알림마다 read_at 을 채워요. 모두 읽음은 안 읽은 행 수만큼 행을 갱신해요.',
  cursor: '사용자마다 읽음 커서 하나만 옮겨요. 커서 밖에서 읽은 알림은 예외 행으로 따로 남겨요.',
};

const COUNT_HINT: Record<CountMode, string> = {
  count: '배지를 열 때마다 안 읽은 행을 세요. 칸이 없어서 어긋나지 않아요.',
  counter: '안 읽은 수를 칸 하나에 저장해요. 배지는 칸 하나만 읽어요.',
};

const INITIAL_OPTIONS = [10, 40, 100, 200];

export default function Simulator() {
  const [readMode, setReadMode] = useState<ReadMode>('flag');
  const [countMode, setCountMode] = useState<CountMode>('count');
  const [counterWrite, setCounterWrite] = useState<CounterWrite>('checked');
  const [initial, setInitial] = useState(40);
  const [run, setRun] = useState<Run>(() => createRun({ readMode, countMode, counterWrite, initial }));

  const config: Config = { readMode, countMode, counterWrite, initial };
  const restart = (next: Partial<Config>) => {
    const merged = { ...config, ...next };
    setRun(createRun(merged));
  };

  const badge = badgeValue(run);
  const truth = trueUnread(run);
  const diff = badge - truth;
  const lastLog = run.log[run.log.length - 1];
  const shown = run.log.slice(-8);

  return (
    <div className="nb-lab">
      <RadioGroup
        label="읽음 기록 방식"
        options={READ_MODES.map((m) => ({ value: m, label: READ_MODE_LABEL[m] }))}
        value={readMode}
        onValueChange={(v) => {
          setReadMode(v);
          restart({ readMode: v });
        }}
      />
      <p className="nb-lab__hint">{READ_HINT[readMode]}</p>

      <RadioGroup
        label="안 읽은 수를 세는 방식"
        options={COUNT_MODES.map((m) => ({ value: m, label: COUNT_MODE_LABEL[m] }))}
        value={countMode}
        onValueChange={(v) => {
          setCountMode(v);
          restart({ countMode: v });
        }}
      />
      <p className="nb-lab__hint">{COUNT_HINT[countMode]}</p>

      <RadioGroup
        label="카운터 차감 규칙"
        options={COUNTER_WRITES.map((w) => ({ value: w, label: COUNTER_WRITE_LABEL[w] }))}
        value={counterWrite}
        onValueChange={(v) => {
          setCounterWrite(v);
          restart({ counterWrite: v });
        }}
      />
      <p className="nb-lab__hint">
        {countMode === 'counter'
          ? counterWrite === 'checked'
            ? '영향받은 행 수가 1일 때만 칸을 줄여요.'
            : '요청마다 칸을 줄여서, 동시에 들어온 요청은 칸을 두 번 줄여요.'
          : '카운터 칸을 쓰지 않을 때는 이 설정이 영향을 주지 않아요.'}
      </p>

      <div className="nb-lab__controls">
        <label className="nb-field">
          <span>처음 안 읽은 알림 {initial}개</span>
          <select
            value={initial}
            onChange={(e) => {
              const n = Number(e.target.value);
              setInitial(n);
              restart({ initial: n });
            }}
          >
            {INITIAL_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={() => restart({})}>
          처음부터 다시
        </Button>
      </div>

      <div className="nb-lab__actions" role="group" aria-label="동작">
        {ACTIONS.map((a: Action) => (
          <Button
            key={a}
            variant={a === 'read-all' ? 'primary' : 'secondary'}
            size="sm"
            disabled={a === 'recount' && countMode !== 'counter'}
            onClick={() => setRun((r) => apply(r, a))}
          >
            {ACTION_LABEL[a]}
          </Button>
        ))}
      </div>

      <section className="nb-lab__results" aria-label="결과">
        <Stat label="배지 숫자" value={badge} unit="개" />
        <Stat label="실제 안 읽은 수" value={truth} unit="개" />
        <Stat
          label="배지와 실제의 차이"
          value={diff > 0 ? `+${diff}` : `${diff}`}
          tone={diff !== 0 ? 'accent' : 'ink'}
        />
        <Stat label="배지 한 번에 읽는 행" value={badgeRows(run)} unit="행" />
        <Stat label="이번 동작 갱신 행" value={lastLog ? lastLog.touched : 0} unit="행" />
      </section>

      {diff !== 0 && (
        <p className="nb-lab__alarm" role="status">
          배지가 실제보다 {Math.abs(diff)}개 {diff > 0 ? '많아요' : '적어요'}. 칸이 실제 행과 어긋났어요.
          <Tag variant="accent">재계산 필요</Tag>
        </p>
      )}

      <table className="nb-table">
        <caption>동작 기록 (최근 8번, 누적 갱신 {run.totalTouched}행)</caption>
        <thead>
          <tr>
            <th scope="col">동작</th>
            <th scope="col">갱신 행</th>
            <th scope="col">배지</th>
            <th scope="col">실제</th>
            <th scope="col">설명</th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td colSpan={5}>아직 동작이 없어요. 위에서 동작을 눌러 보세요.</td>
            </tr>
          )}
          {shown.map((e) => (
            <tr key={e.step}>
              <th scope="row">{ACTION_LABEL[e.action]}</th>
              <td>{e.touched}</td>
              <td>{e.badge}</td>
              <td>{e.truth}</td>
              <td>{e.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="nb-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
