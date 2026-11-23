import { Button, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  ACTIONS,
  type CaptureSite,
  CREATE_PRICE,
  KIND_LABEL,
  makeStep,
  presetSteps,
  type RecordMode,
  restoreAt,
  run,
  type Step,
} from './model';
import './Simulator.css';

const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'short',
  timeStyle: 'short',
});

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;

const MODE_OPTIONS: readonly { value: RecordMode; label: string; hint: string }[] = [
  { value: 'current', label: '현재 값만', hint: '현재 값 한 줄만 고쳐요. 이전 값은 덮여요.' },
  {
    value: 'snapshot',
    label: '이력 테이블 (스냅샷)',
    hint: '바뀐 뒤의 행 전체를 쌓아요. 행위자와 시각은 남지만, 무엇에서 바뀌었는지는 안 남아요.',
  },
  {
    value: 'event',
    label: '이벤트 기록',
    hint: '바뀌기 전 값, 바뀐 뒤 값, 행위와 요청 id 를 한 줄에 남겨요.',
  },
];

const SITE_OPTIONS: readonly { value: CaptureSite; label: string; hint: string }[] = [
  { value: 'app', label: '앱 코드에서 기록', hint: '앱 요청이 돌 때만 기록해요. DB에서 직접 바꾼 값은 빠져요.' },
  { value: 'trigger', label: 'DB 트리거에서 기록', hint: 'DB 쓰기마다 기록해요. 앱을 거치지 않은 변경도 남아요.' },
];

const RESTORE_TEXT = {
  exact: (value: number) => `기록으로 이 시점 값 ${won(value)}을 맞출 수 있어요.`,
  current: '옛 값이 현재 값으로 덮여서 이 시점 값을 되돌릴 수 없어요.',
  none: '이 시점 이전 기록이 없어서 되돌릴 수 없어요.',
};

export default function Simulator() {
  const [steps, setSteps] = useState<Step[]>(() => [makeStep('create', 0, CREATE_PRICE)]);
  const [mode, setMode] = useState<RecordMode>('event');
  const [site, setSite] = useState<CaptureSite>('app');
  const [target, setTarget] = useState<number | null>(null);

  const last = steps.length - 1;
  const t = Math.min(target ?? last, last);
  const result = run(steps, mode, site);
  const restored = restoreAt(result, steps, mode, t);
  const modeHint = MODE_OPTIONS.find((m) => m.value === mode)?.hint ?? '';
  const siteHint = SITE_OPTIONS.find((s) => s.value === site)?.hint ?? '';

  const add = (kind: Step['kind'], price?: number) => {
    setSteps((prev) => [...prev, makeStep(kind, prev.length, price)]);
  };

  const reset = () => {
    setSteps([makeStep('create', 0, CREATE_PRICE)]);
    setTarget(null);
  };

  const loadPreset = () => {
    setSteps(presetSteps());
    setTarget(null);
  };

  const current = result.truth[last];

  return (
    <div className="au-lab">
      <div className="au-lab__controls">
        <RadioGroup
          label="기록 방식"
          options={MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
          value={mode}
          onValueChange={(v) => setMode(v as RecordMode)}
        />
        <p className="au-lab__hint">{modeHint}</p>
        <RadioGroup
          label="기록 위치"
          options={SITE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          value={site}
          onValueChange={(v) => setSite(v as CaptureSite)}
        />
        <p className="au-lab__hint">{siteHint}</p>
      </div>

      <div className="au-lab__actions" role="group" aria-label="동작">
        {ACTIONS.map((a) => (
          <Button key={a.id} variant="ghost" size="sm" onClick={() => add(a.kind, a.price)}>
            {a.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={loadPreset}>
          예시 순서 불러오기
        </Button>
        <Button variant="ghost" size="sm" onClick={reset}>
          처음부터
        </Button>
      </div>

      <section className="au-lab__panel" aria-label="현재 상태">
        <h3>현재 값</h3>
        <p className="au-lab__value" data-deleted={current.deleted}>
          {won(current.price)}
          {current.deleted ? ' · 삭제됨' : ''}
        </p>
        {result.missed > 0 && (
          <p className="au-lab__warn" data-missed={result.missed}>
            기록에서 빠진 변경이 {result.missed}번 있어요.
          </p>
        )}
      </section>

      <section className="au-lab__panel" aria-label="이력 목록">
        <h3>이력 목록</h3>
        {mode === 'current' ? (
          <p className="au-lab__hint">현재 값만 남기면 이력 목록이 비어요.</p>
        ) : (
          <table className="au-lab__table">
            <thead>
              <tr>
                <th scope="col">시각 (서울)</th>
                <th scope="col">행위자</th>
                <th scope="col">동작</th>
                {mode === 'event' && <th scope="col">이전 값</th>}
                <th scope="col">새 값</th>
                {mode === 'event' && <th scope="col">요청 id</th>}
              </tr>
            </thead>
            <tbody>
              {[...result.history].reverse().map((e) => (
                <tr key={e.at}>
                  <td>
                    <time dateTime={e.at}>{KST.format(new Date(e.at))}</time>
                  </td>
                  <td>{e.actor}</td>
                  <td>{e.kind ? KIND_LABEL[e.kind] : '기록'}</td>
                  {mode === 'event' && <td>{e.before ? won(e.before.price) : '—'}</td>}
                  <td>
                    {won(e.after.price)}
                    {e.after.deleted ? ' · 삭제' : ''}
                  </td>
                  {mode === 'event' && <td>{e.requestId ?? '기록 안 함'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="au-lab__panel" aria-label="시점 복원">
        <h3>시점 복원</h3>
        {steps.length > 1 ? (
          <RadioGroup
            label="어느 동작 직후 값을 되돌려 볼까요?"
            options={steps.map((s, i) => ({
              value: String(i),
              label: `#${i} ${KIND_LABEL[s.kind]} · ${KST.format(new Date(s.at))}`,
            }))}
            value={String(t)}
            onValueChange={(v) => setTarget(Number(v))}
          />
        ) : null}
        <p className="au-lab__value" data-status={restored.status}>
          {restored.status === 'exact' && RESTORE_TEXT.exact(restored.value?.price ?? 0)}
          {restored.status === 'stale' &&
            `기록에 빠진 변경이 있어서 이 시점 값이 틀려요. 기록은 ${won(restored.value?.price ?? 0)}, 실제는 ${won(result.truth[t].price)}이에요.`}
          {restored.status === 'lost' && (mode === 'current' ? RESTORE_TEXT.current : RESTORE_TEXT.none)}
        </p>
      </section>

      <p className="au-lab__hint">
        수치는 감을 잡기 위한 예시예요. 시각은 UTC 로 저장하고, 화면에서만 서울 시간으로 바꿔 보여 줘요.
      </p>
    </div>
  );
}
