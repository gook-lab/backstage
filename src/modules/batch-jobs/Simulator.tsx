import { Button, Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import { RESTART_LABEL, RESTARTS, type Restart, type Params, simulate } from './model';
import './Simulator.css';

const RESTART_HINT: Record<Restart, string> = {
  scratch: '처음 건부터 다시 세요. 멱등이 아니면 이미 정산된 건이 전부 한 번 더 나가요.',
  checkpoint: '마지막으로 커밋된 청크 끝부터 이어요. 커밋 전에 죽은 부분만 다시 세요.',
};

export default function Simulator() {
  const ids = useId();
  const [total, setTotal] = useState(1000);
  const [chunk, setChunk] = useState(100);
  const [crash, setCrash] = useState(true);
  const [crashPct, setCrashPct] = useState(55);
  const [restart, setRestart] = useState<Restart>('checkpoint');
  const [idempotent, setIdempotent] = useState(true);
  const [lock, setLock] = useState(true);
  const [rival, setRival] = useState(false);
  const [seed, setSeed] = useState(7);
  const [tick, setTick] = useState(0);

  const params: Params = { total, chunk, crash, crashPct, restart, idempotent, lock, rival, seed };
  const result = simulate(params);
  const shownTick = Math.min(tick, result.totalTicks);
  const doneNow = result.doneByTick[shownTick] ?? 0;
  const percent = Math.round((doneNow / total) * 100);
  const once = result.applied.filter((n) => n === 1).length;
  const twice = result.applied.filter((n) => n >= 2).length;

  return (
    <div className="bj-lab">
      <div className="bj-lab__controls">
        <label className="bj-field">
          <span>정산 대상 {total}건</span>
          <input
            type="range"
            min={100}
            max={1000}
            step={100}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
          />
        </label>
        <label className="bj-field">
          <span>청크 크기 {chunk}건마다 커밋</span>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={chunk}
            onChange={(e) => setChunk(Number(e.target.value))}
          />
        </label>
      </div>

      <RadioGroup
        label="재시작 방식"
        options={RESTARTS.map((r) => ({ value: r, label: RESTART_LABEL[r] }))}
        value={restart}
        onValueChange={setRestart}
      />
      <p className="bj-lab__hint">{RESTART_HINT[restart]}</p>

      <div className="bj-lab__flags">
        <Checkbox
          label="중간에 워커가 죽어요"
          hint="정산 대상 일부를 처리한 뒤 실행이 끊겨요."
          checked={crash}
          onCheckedChange={(v) => setCrash(v === true)}
        />
        <label className="bj-field">
          <span>실패 지점 {crashPct}% 처리 뒤</span>
          <input
            type="range"
            min={5}
            max={95}
            step={5}
            value={crashPct}
            disabled={!crash}
            onChange={(e) => setCrashPct(Number(e.target.value))}
          />
        </label>
        <Checkbox
          label="멱등 처리를 켜요 (이미 정산된 건은 건너뛰어요)"
          hint="건마다 정산 키를 확인하고 나서 호출해요. 확인과 기록은 한 번에 끝나야 해요."
          checked={idempotent}
          onCheckedChange={(v) => setIdempotent(v === true)}
        />
        <Checkbox
          label="같은 배치가 두 번 돌지 않게 잠가요"
          hint="잠금을 잡은 실행이 있으면 두 번째 실행은 시작하지 않아요."
          checked={lock}
          onCheckedChange={(v) => setLock(v === true)}
        />
        <Checkbox
          label="두 번째 실행을 같은 시각에 시작해요"
          hint="관리자가 버튼을 두 번 누르거나 워커가 두 대 뜬 상황이에요."
          checked={rival}
          onCheckedChange={(v) => setRival(v === true)}
        />
      </div>

      <div className="bj-lab__seed">
        <span>시드 {seed} · 같은 시드는 건마다 외부 호출 시간이 같아요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="bj-lab__results" aria-label="정산 결과">
        <Stat label="총 처리 시간" value={result.totalTicks} unit="틱" />
        <Stat
          label="중복 정산 건수"
          value={result.duplicates}
          unit="건"
          tone={result.duplicates > 0 ? 'accent' : 'ink'}
        />
        <Stat label="다시 본 건수" value={result.revisits} unit="건" />
        <Stat label="빠진 건수" value={result.missing} unit="건" tone={result.missing > 0 ? 'accent' : 'ink'} />
        <Stat label="거절된 두 번째 실행" value={result.rejectedRuns} unit="회" />
      </section>

      {result.duplicates > 0 && (
        <p className="bj-lab__alarm" role="status">
          같은 정산 건 {result.duplicates}건이 두 번 나갔어요. 재시작 지점이 커밋 뒤가 아니었거나, 두 실행이 같은 건을
          집었어요.
        </p>
      )}

      <section className="bj-lab__progress" aria-labelledby={`${ids}-progress`}>
        <h3 id={`${ids}-progress`}>진행률 — 시각별 처리 건수</h3>
        <div
          className="bj-bar"
          role="progressbar"
          aria-label="정산 진행률"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneNow}
        >
          <div className="bj-bar__fill" style={{ width: `${percent}%` }} />
        </div>
        <label className="bj-field">
          <span>
            틱 {shownTick} / {result.totalTicks} · 처리 {doneNow} / {total}건 ({percent}%)
          </span>
          <input
            type="range"
            min={0}
            max={result.totalTicks}
            step={1}
            value={shownTick}
            onChange={(e) => setTick(Number(e.target.value))}
          />
        </label>
        <p className="bj-lab__note">
          {result.crashTick === null
            ? '실패 없이 끝났어요.'
            : `틱 ${result.crashTick} 에 워커가 죽었어요. 건 ${result.resumeFrom} 부터 다시 시작했어요.`}
        </p>
      </section>

      <dl className="bj-lab__counts">
        <div>
          <dt>한 번 정산된 건</dt>
          <dd>{once}건</dd>
        </div>
        <div>
          <dt>두 번 이상 정산된 건</dt>
          <dd>
            {twice}건{twice > 0 && <Tag variant="accent">중복</Tag>}
          </dd>
        </div>
      </dl>
    </div>
  );
}
