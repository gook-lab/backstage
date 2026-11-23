import { NavLink } from 'react-router';
import { doneCount, useProgress } from '../lib/progress';
import { MODULES, TRACKS } from '../modules';

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const progress = useProgress();
  return (
    <nav className="sidenav" aria-label="글 목록">
      <NavLink to="/" end className="sidenav__home" onClick={onNavigate}>
        전체 로드맵
      </NavLink>
      {TRACKS.map((track) => {
        const items = MODULES.filter((m) => m.track === track.id);
        if (items.length === 0) return null;
        return (
          <section key={track.id} className="sidenav__group" aria-labelledby={`nav-${track.id}`}>
            <h2 id={`nav-${track.id}`} className="sidenav__track">
              {track.short}
            </h2>
            <ol className="sidenav__list">
              {items.map((m) => {
                const ids = m.checklist.map((c) => c.id);
                const complete = ids.length > 0 && doneCount(progress, m.id, ids) === ids.length;
                return (
                  <li key={m.id}>
                    <NavLink to={`/m/${m.id}`} className="sidenav__link" onClick={onNavigate}>
                      <span className="sidenav__order">{String(m.order).padStart(2, '0')}</span>
                      <span className="sidenav__title">{m.title}</span>
                      {complete && (
                        <span className="sidenav__done" aria-label="판단 기준 모두 확인">
                          ✓
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </nav>
  );
}
