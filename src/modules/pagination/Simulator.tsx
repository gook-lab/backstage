import { Alert, Button, Stat, Tag, cx } from '@gook-lab/ui';
import { useId, useReducer } from 'react';
import {
  type Judgement,
  PAGE_SIZE,
  type Post,
  initialLab,
  isDone,
  judge,
  labReducer,
  readOffset,
  tokenOf,
} from './model';
import './Simulator.css';

const COST_PAGES = [1, 2, 3, 10, 100, 1000];

const countText = (j: Judgement) => `중복 ${j.duplicates.length}개 · 빠진 글 ${j.missing.length}개`;

function annotate(pages: Post[][]) {
  const seen = new Set<number>();
  return pages.map((items) =>
    items.map((post) => {
      const repeated = seen.has(post.id);
      seen.add(post.id);
      return { post, repeated };
    }),
  );
}

interface FeedColumnProps {
  title: string;
  hint: string;
  pages: Post[][];
  judgement: Judgement;
}

function FeedColumn({ title, hint, pages, judgement }: FeedColumnProps) {
  const titleId = useId();
  const gone = new Set(judgement.gone);
  const rows = annotate(pages);
  return (
    <section className="pg-col" aria-labelledby={titleId}>
      <h3 id={titleId} className="pg-col__title">
        {title}
      </h3>
      <p className="pg-col__hint">{hint}</p>
      {rows.length === 0 ? (
        <p className="pg-empty">아직 받은 글이 없어요.</p>
      ) : (
        <ol className="pg-pages">
          {rows.map((items, pageIndex) => (
            <li key={pageIndex}>
              <p className="pg-page__label">{pageIndex + 1}페이지</p>
              <ol className="pg-list">
                {items.map(({ post, repeated }) => (
                  <li
                    key={`${pageIndex}-${post.id}`}
                    className={cx('pg-row', repeated && 'pg-row--repeat', gone.has(post.id) && 'pg-row--gone')}
                  >
                    <span className="pg-row__title">{post.title}</span>
                    {repeated && <Tag variant="accent">중복</Tag>}
                    {gone.has(post.id) && <Tag variant="outline">지워짐</Tag>}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
      {judgement.missing.length > 0 && (
        <div className="pg-missing">
          <p className="pg-page__label">받지 못한 글</p>
          <ul className="pg-list">
            {judgement.missing.map((post) => (
              <li key={post.id} className="pg-row pg-row--missing">
                <span className="pg-row__title">{post.title}</span>
                <Tag variant="accent">누락</Tag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function Simulator() {
  const [state, dispatch] = useReducer(labReducer, undefined, initialLab);
  const { posts } = state.db;
  const offsetJudge = judge(state.offset, state.snapshot, posts);
  const keysetJudge = judge(state.keyset, state.snapshot, posts);
  const started = state.offset.length > 0;
  const done = isDone(state.offset) && isDone(state.keyset);
  const loadLabel = !started ? '1페이지 불러오기' : done ? '끝까지 불러왔어요' : '다음 페이지 불러오기';
  const lastDiscarded = started ? readOffset(posts, state.offset.length).discarded : 0;
  const cursorToken = tokenOf(state.keyset);
  const offsetBroken = offsetJudge.duplicates.length + offsetJudge.missing.length > 0;
  const keysetClean = started && keysetJudge.duplicates.length + keysetJudge.missing.length === 0;
  const summary = started ? `offset: ${countText(offsetJudge)}. keyset: ${countText(keysetJudge)}.` : '';

  return (
    <div className="pg">
      <p className="pg-intro">
        서버에는 최신순 글이 {posts.length}개 있어요. 한 페이지는 {PAGE_SIZE}개예요. 1페이지를 먼저 받고, 서버에 일이
        생긴 뒤 다음 페이지를 받아 보세요.
      </p>

      <div className="pg-controls" role="group" aria-label="서버에 일어난 일">
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'insert', count: 3 })}>
          새 글 3개 들어옴
        </Button>
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'deleteSecond' })}>
          1페이지의 글 하나 삭제됨
        </Button>
      </div>

      <div className="pg-controls">
        <Button disabled={done} onClick={() => dispatch({ type: 'load' })}>
          {loadLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'reset' })}>
          처음부터 다시
        </Button>
      </div>

      <p className="pg-summary" aria-live="polite">
        {state.last}
        {summary && ` ${summary}`}
      </p>

      <div className="pg-columns">
        <FeedColumn
          title="offset · LIMIT / OFFSET"
          hint="페이지 번호만큼 앞을 세고 버린 뒤 자른 글이에요."
          pages={state.offset}
          judgement={offsetJudge}
        />
        <FeedColumn
          title="keyset · 커서"
          hint="마지막으로 받은 글 다음부터 이어 받은 글이에요."
          pages={state.keyset}
          judgement={keysetJudge}
        />
      </div>

      {cursorToken && (
        <p className="pg-token">
          keyset 이 다음 요청에 쓸 커서 토큰 <code>{cursorToken}</code>
        </p>
      )}

      {offsetBroken && (
        <Alert tone="warning" title="offset 목록이 어긋났어요">
          페이지 사이에 글이 들어오거나 지워지면 offset 의 자리 번호가 밀려요. 그래서 이미 본 글이 다시 나오거나 아직 못
          본 글이 건너뛰어져요.
        </Alert>
      )}
      {keysetClean && (
        <Alert tone="success" title="keyset 목록은 그대로예요">
          마지막으로 받은 글 다음부터 이어 받아서 중복도 누락도 없어요.
        </Alert>
      )}

      <div className="pg-stats">
        <Stat label="offset 이 읽고 버린 행" value={lastDiscarded} unit="행" />
        <Stat label="keyset 이 읽고 버린 행" value={0} unit="행" />
      </div>
      <p className="pg-hint">마지막으로 받은 페이지 기준이에요.</p>

      <table className="pg-cost">
        <caption>
          뒤 페이지로 갈수록 · 예시 계산 (페이지 크기 {PAGE_SIZE}, keyset 은 인덱스에서 바로 이어 읽는다고 가정)
        </caption>
        <thead>
          <tr>
            <th scope="col">페이지</th>
            <th scope="col">offset 이 읽고 버린 행</th>
            <th scope="col">keyset 이 읽고 버린 행</th>
          </tr>
        </thead>
        <tbody>
          {COST_PAGES.map((page) => (
            <tr key={page}>
              <th scope="row">{page}페이지</th>
              <td>{readOffset([], page).discarded.toLocaleString('ko-KR')}</td>
              <td>0</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
