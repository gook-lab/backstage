import { Checkbox } from '@gook-lab/ui';
import { Suspense, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { Toc } from '../components/Toc';
import { toggleCheck, useProgress } from '../lib/progress';
import { moduleById, nextModule, prevModule, TRACKS } from '../modules';
import { NotFound } from './NotFound';

export function ModulePage() {
  const { id } = useParams();
  const m = moduleById(id);
  const progress = useProgress();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = m ? `${m.title} · backstage` : 'backstage';
  }, [m]);
  if (!m) return <NotFound />;
  const checked = new Set(progress[m.id] ?? []);
  const prev = prevModule(m.id);
  const next = nextModule(m.id);
  const track = TRACKS.find((t) => t.id === m.track);
  const { Article, Simulator } = m;
  return (
    <div className="post">
      <article className="module" aria-labelledby="module-title" ref={body}>
        <p className="module__crumb">
          {track?.short} · {String(m.order).padStart(2, '0')} · {m.minutes}분
        </p>
        <p className="module__question">{m.question}</p>
        <h1 id="module-title">{m.title}</h1>
        <p className="lede">{m.summary}</p>

        <Suspense fallback={<p>글을 불러오는 중이에요.</p>}>
          <div className="prose">
            <Article />
          </div>
        </Suspense>

        <section className="module__lab" aria-labelledby="lab-title">
          <h2 id="lab-title">직접 돌려 보기</h2>
          <Suspense fallback={<p>시뮬레이터를 불러오는 중이에요.</p>}>
            <Simulator />
          </Suspense>
        </section>

        {m.checklist.length > 0 && (
          <section className="module__check" aria-labelledby="check-title">
            <h2 id="check-title">이제 판단할 수 있나요?</h2>
            <ul>
              {m.checklist.map((c) => (
                <li key={c.id}>
                  <Checkbox
                    label={c.text}
                    checked={checked.has(c.id)}
                    onCheckedChange={() => toggleCheck(m.id, c.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {m.sources.length > 0 && (
          <section className="module__sources" aria-labelledby="sources-title">
            <h2 id="sources-title">근거 문서</h2>
            <ul>
              {m.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="pager" aria-label="이전 글 · 다음 글">
          {prev ? (
            <Link to={`/m/${prev.id}`} className="pager__link" rel="prev">
              <span className="pager__label">이전 글</span>
              <span className="pager__title">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/m/${next.id}`} className="pager__link pager__link--next" rel="next">
              <span className="pager__label">다음 글</span>
              <span className="pager__title">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>
      <aside className="post__toc">
        <Toc root={body} />
      </aside>
    </div>
  );
}
