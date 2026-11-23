import { Alert, Button, Stat, Tag } from '@gook-lab/ui';
import { useId, useMemo, useState } from 'react';
import {
  CELEB_AUTHOR,
  DEFAULTS,
  type Params,
  STRATEGY_TEXT,
  STRATEGY_NAME,
  type Strategy,
  STRATEGIES,
  busiestReader,
  deliverySeconds,
  fanoutWrites,
  isCelebrity,
  loadTimeline,
  makeGraph,
  normalAuthor,
  workerLoad,
} from './model';
import './Simulator.css';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (value: number) => void;
}

function RangeField({ label, value, min, max, step, text, onChange }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="ff-field">
      <div className="ff-field__head">
        <label htmlFor={id} className="ff-field__label">
          {label}
        </label>
        <output htmlFor={id}>{text}</output>
      </div>
      <input
        id={id}
        className="ff-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function Simulator() {
  const [users, setUsers] = useState(DEFAULTS.users);
  const [celebrityAt, setCelebrityAt] = useState(DEFAULTS.celebrityAt);
  const [activePct, setActivePct] = useState(DEFAULTS.activePct);
  const [writeRate, setWriteRate] = useState(DEFAULTS.writeRate);
  const [postsPerSec, setPostsPerSec] = useState(DEFAULTS.postsPerSec);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [picked, setPicked] = useState<Strategy>('hybrid');

  const graph = useMemo(() => makeGraph(users, seed), [users, seed]);
  const params: Params = { users, seed, celebrityAt, activeShare: activePct / 100 };
  const normal = normalAuthor(graph);
  const reader = busiestReader(graph);

  const rows = STRATEGIES.map((strategy) => {
    const writesNormal = fanoutWrites(graph, normal, strategy, params);
    return {
      strategy,
      writesNormal,
      writesCeleb: fanoutWrites(graph, CELEB_AUTHOR, strategy, params),
      delayMs: writesNormal === 0 ? 0 : Math.round(deliverySeconds(writesNormal, writeRate) * 1000),
      queries: loadTimeline(graph, reader, strategy, params).queries,
    };
  });

  const load = loadTimeline(graph, reader, picked, params);
  const utilization = Math.round(workerLoad(fanoutWrites(graph, normal, picked, params), postsPerSec, writeRate) * 100);

  return (
    <div className="ff">
      <p className="ff-intro">
        팔로워가 많은 사람의 글을 누구에게 어떻게 나눠 줄지 고르는 시뮬레이터예요. 사용자 {users}명, 가장 많이
        팔로우하는 사용자가 여는 타임라인을 기준으로 계산해요.
      </p>

      <div className="ff-grid">
        <RangeField
          label="사용자 수"
          value={users}
          min={50}
          max={300}
          step={10}
          text={`${users}명`}
          onChange={setUsers}
        />
        <RangeField
          label="유명 사용자 기준"
          value={celebrityAt}
          min={5}
          max={100}
          step={1}
          text={`팔로워 ${celebrityAt}명 이상`}
          onChange={setCelebrityAt}
        />
        <RangeField
          label="활성 사용자 비율"
          value={activePct}
          min={0}
          max={100}
          step={5}
          text={`${activePct}%`}
          onChange={setActivePct}
        />
        <RangeField
          label="쓰기 처리량"
          value={writeRate}
          min={500}
          max={20000}
          step={500}
          text={`초당 ${writeRate.toLocaleString('ko-KR')}건`}
          onChange={setWriteRate}
        />
        <RangeField
          label="초당 새 글 수"
          value={postsPerSec}
          min={1}
          max={100}
          step={1}
          text={`초당 ${postsPerSec}개`}
          onChange={setPostsPerSec}
        />
      </div>

      <div className="ff-actions">
        <Button variant="ghost" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 그래프 만들기
        </Button>
      </div>

      <table className="ff-table">
        <caption>
          글 한 건 기준 예시 계산 (일반 사용자 {normal}, 유명 후보 사용자 {CELEB_AUTHOR}, 타임라인을 여는 사용자{' '}
          {reader})
        </caption>
        <thead>
          <tr>
            <th scope="col">방식</th>
            <th scope="col">일반 사용자 글 · 쓰기</th>
            <th scope="col">유명 사용자 글 · 쓰기</th>
            <th scope="col">쓰기 완료까지</th>
            <th scope="col">타임라인 질의 수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.strategy}>
              <th scope="row">{STRATEGY_NAME[row.strategy]}</th>
              <td>{row.writesNormal.toLocaleString('ko-KR')}</td>
              <td>{row.writesCeleb.toLocaleString('ko-KR')}</td>
              <td>{row.strategy === 'pull' ? '읽을 때' : `${row.delayMs.toLocaleString('ko-KR')} ms`}</td>
              <td>{row.queries.toLocaleString('ko-KR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ff-picks" role="group" aria-label="자세히 볼 방식">
        {STRATEGIES.map((strategy) => (
          <Button
            key={strategy}
            variant={picked === strategy ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={picked === strategy}
            onClick={() => setPicked(strategy)}
          >
            {STRATEGY_NAME[strategy]}
          </Button>
        ))}
      </div>
      <p className="ff-hint">{STRATEGY_TEXT[picked]}</p>

      <div className="ff-stats">
        <Stat label="타임라인 한 번 열 때 질의" value={load.queries} unit="번" />
        <Stat label="화면에 보인 글" value={load.shown.length} unit="개" />
        <Stat label="쓰기 워커 사용률" value={utilization} unit="%" />
      </div>

      {load.rebuilt && (
        <Alert tone="info" title="이 사용자는 지금 활성 상태가 아니에요">
          받은편지함이 낡았다고 보고, 팔로우한 사람들의 글을 한 번 당겨 와요.
        </Alert>
      )}

      <div className="ff-timeline">
        <p className="ff-hint">최신순으로 정렬하고 같은 글은 한 번만 보여 줘요.</p>
        <ol className="ff-list">
          {load.shown.map((post) => (
            <li key={post.id} className="ff-row">
              <span className="ff-row__title">글 #{post.id}</span>
              <span className="ff-row__meta">사용자 {post.authorId}</span>
              {isCelebrity(graph, post.authorId, celebrityAt) && <Tag variant="outline">유명</Tag>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
