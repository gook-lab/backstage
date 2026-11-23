import { Tag } from '@gook-lab/ui';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { doneCount, useProgress } from '../lib/progress';
import { MODULES, TRACKS } from '../modules';

export function Roadmap() {
  const progress = useProgress();
  useEffect(() => {
    document.title = 'backstage — FE 가 알아야 할 BE';
  }, []);
  return (
    <section aria-labelledby="roadmap-title">
      <h1 id="roadmap-title">API 뒤에서 무슨 일이 일어날까요</h1>
      <p className="lede">
        서버 개발자가 매일 고민하는 것들을 FE 의 질문에서 시작해 정리했어요. 글을 읽고, 직접 돌려 보고, 판단 기준을
        체크해 보세요.
      </p>
      {TRACKS.map((track) => {
        const items = MODULES.filter((m) => m.track === track.id);
        if (items.length === 0) return null;
        return (
          <section key={track.id} className="track" aria-labelledby={`track-${track.id}`}>
            <h2 id={`track-${track.id}`}>{track.title}</h2>
            <p className="track__desc">{track.description}</p>
            <ol className="roadmap">
              {items.map((m) => {
                const ids = m.checklist.map((c) => c.id);
                const done = doneCount(progress, m.id, ids);
                const complete = ids.length > 0 && done === ids.length;
                return (
                  <li key={m.id} className="roadmap__item" data-complete={complete || undefined}>
                    <Link to={`/m/${m.id}`} className="roadmap__card">
                      <span className="roadmap__order">{String(m.order).padStart(2, '0')}</span>
                      <span className="roadmap__body">
                        <span className="roadmap__question">{m.question}</span>
                        <strong className="roadmap__title">{m.title}</strong>
                        <span className="roadmap__meta">
                          {m.tags.map((t) => (
                            <Tag key={t} variant="outline">
                              {t}
                            </Tag>
                          ))}
                          <span>{m.minutes}분</span>
                          {ids.length > 0 && (
                            <span aria-label={`판단 기준 ${ids.length}개 중 ${done}개 확인`}>
                              {done}/{ids.length}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </section>
  );
}
