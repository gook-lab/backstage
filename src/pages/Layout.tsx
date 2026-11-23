import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="shell">
      <header className="shell__top">
        <Link to="/" className="shell__brand">
          backstage
        </Link>
        <span className="shell__tagline">FE 가 알아야 할 BE</span>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
      <footer className="shell__foot">글마다 근거 문서를 달아 두었어요. 수치는 감을 잡기 위한 예시예요.</footer>
    </div>
  );
}
