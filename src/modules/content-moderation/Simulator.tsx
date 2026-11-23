import { Button, Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import { HORIZON, QUEUE_LABEL, QUEUE_MODES, type QueueMode, simulate } from './model';
import './Simulator.css';

const QUEUE_HINT: Record<QueueMode, string> = {
  select: '잡지 않고 고른 항목을 두 검수자가 함께 봐요. 둘 다 같은 항목을 처리할 수 있어요.',
  skip: '처리 중인 항목은 잠겨서 다른 검수자가 건너뛰어요. 건너뛴 행은 목록에서 빠져 보여요.',
};

export default function Simulator() {
  const chartId = useId();
  const [reporters, setReporters] = useState(8);
  const [retries, setRetries] = useState(2);
  const [dedupe, setDedupe] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [brigade, setBrigade] = useState(6);
  const [reviewers, setReviewers] = useState(3);
  const [backlog, setBacklog] = useState(8);
  const [queue, setQueue] = useState<QueueMode>('select');
  const [seed, setSeed] = useState(7);

  const result = simulate({
    reporters,
    retries,
    dedupe,
    threshold,
    brigade,
    reviewers,
    backlog,
    queue,
    seed,
  });

  const hideTick = result.hideAt.violating;
  const blockedNote =
    result.duplicateBlocked > 0 ? `유니크 제약이 막은 중복 신고는 ${result.duplicateBlocked}건이에요.` : undefined;

  return (
    <div className="cm-lab">
      <div className="cm-lab__controls">
        <label className="cm-field">
          <span>실제 신고자 {reporters}명</span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={reporters}
            onChange={(e) => setReporters(Number(e.target.value))}
          />
        </label>
        <label className="cm-field">
          <span>신고 한 번당 재시도 {retries}회</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={retries}
            onChange={(e) => setRetries(Number(e.target.value))}
          />
          <small>버튼을 두 번 누르거나 네트워크가 재시도한 경우예요.</small>
        </label>
        <label className="cm-field">
          <span>자동 숨김 임계값 {threshold}건</span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <label className="cm-field">
          <span>조직적 신고 계정 {brigade}개</span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={brigade}
            onChange={(e) => setBrigade(Number(e.target.value))}
          />
          <small>정상 글 하나에 서로 다른 계정이 몰려요.</small>
        </label>
        <label className="cm-field">
          <span>검수자 {reviewers}명</span>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={reviewers}
            onChange={(e) => setReviewers(Number(e.target.value))}
          />
        </label>
        <label className="cm-field">
          <span>대기열 기존 항목 {backlog}건</span>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={backlog}
            onChange={(e) => setBacklog(Number(e.target.value))}
          />
        </label>
      </div>

      <Checkbox
        label="(신고자, 대상) 유니크 제약 쓰기"
        hint="켜면 같은 사람의 재신고는 첫 신고만 세요. 다른 계정의 조직 신고는 막지 못해요."
        checked={dedupe}
        onCheckedChange={(checked) => setDedupe(checked === true)}
      />
      <p className="cm-lab__hint">
        {dedupe
          ? '같은 사람의 재신고는 한 번만 세요. 다시 신고해도 처음과 같은 응답을 돌려주는 방식이에요.'
          : '같은 사람이 누른 횟수만큼 세요. 재시도 한 번이 신고 한 건이 돼요.'}
      </p>

      <RadioGroup
        label="검수 대기열 가져오는 방식"
        options={QUEUE_MODES.map((m) => ({ value: m, label: QUEUE_LABEL[m] }))}
        value={queue}
        onValueChange={setQueue}
      />
      <p className="cm-lab__hint">{QUEUE_HINT[queue]}</p>

      <div className="cm-lab__seed">
        <span>시드 {seed} · 같은 시드는 같은 신고 흐름이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="cm-lab__results" aria-labelledby={`${chartId}-res`}>
        <h3 id={`${chartId}-res`}>결과</h3>
        <div className="cm-lab__stats">
          <Stat
            label="숨김 시점"
            value={hideTick === undefined ? '숨기지 않아요' : `틱 ${hideTick}`}
            tone={hideTick === undefined ? 'ink' : 'accent'}
          />
          <Stat label="중복 처리 수" value={result.duplicateCounted} unit="건" />
          <Stat label="오탐 숨김" value={result.falseHides} unit="건" tone={result.falseHides > 0 ? 'accent' : 'ink'} />
          <Stat
            label="같은 항목을 두 번 처리한 수"
            value={result.doubleReviewed}
            unit="건"
            tone={result.doubleReviewed > 0 ? 'accent' : 'ink'}
          />
        </div>
        {blockedNote && <p className="cm-lab__note">{blockedNote}</p>}
        <p className="cm-lab__note">
          {result.violatingDecidedAt === undefined
            ? `틱 ${HORIZON} 까지 정책 위반 글의 검수가 끝나지 않았어요.`
            : `정책 위반 글은 틱 ${result.violatingDecidedAt} 에 검수가 끝났어요.`}
        </p>
      </section>

      {result.falseHides > 0 && (
        <p className="cm-lab__alarm" role="status">
          정상 글이 자동으로 숨겨졌어요. 서로 다른 계정 {brigade}개의 신고가 임계값 {threshold}건을 넘었어요.
        </p>
      )}

      <p className="cm-lab__footnote">수치는 감을 잡기 위한 예시예요. 틱은 시뮬레이터의 시간 단위예요.</p>
    </div>
  );
}
