import { Checkbox } from '@gook-lab/ui';
import { Suspense } from 'react';
import { Link, useParams } from 'react-router';
import { toggleCheck, useProgress } from '../lib/progress';
import { MODULES, moduleById } from '../modules';
import { NotFound } from './NotFound';

export function ModulePage() {
  const { id } = useParams();
  const m = moduleById(id);
  const progress = useProgress();
  if (!m) return <NotFound />;
  const checked = new Set(progress[m.id] ?? []);
  const next = MODULES.find((x) => x.order > m.order);
  const { Article, Simulator } = m;
  return (
    <article className="module" aria-labelledby="module-title">
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
                <Checkbox label={c.text} checked={checked.has(c.id)} onChange={() => toggleCheck(m.id, c.id)} />
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

      <nav className="module__nav" aria-label="모듈 이동">
        <Link to="/">로드맵으로</Link>
        {next && <Link to={`/m/${next.id}`}>다음: {next.title}</Link>}
      </nav>
    </article>
  );
}
