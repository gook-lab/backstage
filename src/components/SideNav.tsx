import { Button, Input } from '@gook-lab/ui';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { NavLink } from 'react-router';
import { doneCount, useProgress } from '../lib/progress';
import { MODULES, TRACKS } from '../modules';
import type { StudyModule } from '../modules/types';

/** 제목 · 질문 · 태그 가운데 하나라도 검색어를 포함하면 맞는 글 */
function matches(query: string, m: StudyModule) {
  return [m.title, m.question, ...m.tags].some((text) => text.toLowerCase().includes(query));
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const progress = useProgress();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => (needle === '' ? MODULES : MODULES.filter((m) => matches(needle, m))), [needle]);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && query !== '' && !e.nativeEvent.isComposing) {
      e.stopPropagation();
      setQuery('');
    }
  };

  const status = needle === '' ? '' : visible.length === 0 ? '맞는 글이 없어요' : `${visible.length}개 글`;

  return (
    <nav className="sidenav" aria-label="글 목록">
      <div className="sidenav__search" role="search">
        <Input
          type="search"
          aria-label="글 검색"
          placeholder="제목 · 질문 · 태그 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          fieldProps={{ className: 'sidenav__field' }}
          autoComplete="off"
        />
        {query !== '' && (
          <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
            지우기
          </Button>
        )}
      </div>
      <p className="sidenav__status" aria-live="polite">
        {status}
      </p>
      <NavLink to="/" end className="sidenav__home" onClick={onNavigate}>
        전체 로드맵
      </NavLink>
      {TRACKS.map((track) => {
        const items = visible.filter((m) => m.track === track.id);
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
