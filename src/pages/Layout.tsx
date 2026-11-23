import { Button, Drawer } from '@gook-lab/ui';
import { useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { SideNav } from '../components/SideNav';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="shell">
      <header className="shell__top">
        <Button
          variant="ghost"
          size="sm"
          className="shell__menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen(true)}
        >
          목록
        </Button>
        <Link to="/" className="shell__brand">
          backstage
        </Link>
        <span className="shell__tagline">FE 가 알아야 할 BE</span>
      </header>

      <div className="shell__body">
        <aside className="shell__side">
          <SideNav />
        </aside>
        <main className="shell__main">
          <Outlet />
          <footer className="shell__foot">글마다 근거 문서를 달아 두었어요. 수치는 감을 잡기 위한 예시예요.</footer>
        </main>
      </div>

      <Drawer id="mobile-nav" open={menuOpen} onClose={() => setMenuOpen(false)} side="left" width="sm" title="글 목록">
        <SideNav onNavigate={() => setMenuOpen(false)} />
      </Drawer>
      <ScrollRestoration />
    </div>
  );
}
