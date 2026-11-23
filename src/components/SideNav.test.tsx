import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { MODULES, TRACKS } from '../modules';
import { SideNav } from './SideNav';

const renderNav = () =>
  render(
    <MemoryRouter>
      <SideNav />
    </MemoryRouter>,
  );

const navLinks = () =>
  within(screen.getByRole('navigation', { name: '글 목록' }))
    .getAllByRole('link')
    .filter((a) => a.getAttribute('href')?.startsWith('/m/'))
    .map((a) => a.getAttribute('href'));

const hits = (q: string) =>
  MODULES.filter((m) => [m.title, m.question, ...m.tags].some((t) => t.toLowerCase().includes(q.toLowerCase()))).map(
    (m) => `/m/${m.id}`,
  );

describe('사이드바 글 검색', () => {
  it('처음에는 모든 글을 보여 준다', () => {
    renderNav();
    expect(navLinks()).toEqual(MODULES.map((m) => `/m/${m.id}`));
    expect(document.querySelector('.sidenav__status')).toBeEmptyDOMElement();
  });

  it('제목 · 질문 · 태그에 검색어가 있는 글만 남기고 개수를 알린다', async () => {
    renderNav();
    const target = MODULES[0];
    await userEvent.type(screen.getByRole('searchbox', { name: '글 검색' }), target.title);
    expect(navLinks()).toEqual(hits(target.title));
    expect(navLinks()).toContain(`/m/${target.id}`);
    expect(screen.getByText(`${hits(target.title).length}개 글`)).toHaveAttribute('aria-live', 'polite');
  });

  it('앞뒤 공백과 대소문자를 무시한다', async () => {
    renderNav();
    const target = MODULES[0];
    await userEvent.type(screen.getByRole('searchbox', { name: '글 검색' }), `  ${target.title.toUpperCase()}  `);
    expect(navLinks()).toEqual(hits(target.title));
  });

  it('트랙 제목은 그 트랙에 남은 글이 있을 때만 보인다', async () => {
    renderNav();
    const target = MODULES[0];
    await userEvent.type(screen.getByRole('searchbox', { name: '글 검색' }), target.title);
    const shown = TRACKS.filter((t) =>
      MODULES.some((m) => m.track === t.id && hits(target.title).includes(`/m/${m.id}`)),
    );
    const headings = screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(shown.map((t) => t.short));
  });

  it('맞는 글이 없으면 안내를 보여 준다', async () => {
    renderNav();
    await userEvent.type(screen.getByRole('searchbox', { name: '글 검색' }), '없는글-zzqx');
    expect(navLinks()).toEqual([]);
    expect(screen.getByText('맞는 글이 없어요')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('link', { name: '전체 로드맵' })).toBeInTheDocument();
  });

  it('Esc 를 누르면 검색어가 비워지고 전체 목록이 돌아온다', async () => {
    renderNav();
    const input = screen.getByRole('searchbox', { name: '글 검색' });
    await userEvent.type(input, 'zzqx-없음');
    expect(navLinks()).toEqual([]);
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(navLinks()).toEqual(MODULES.map((m) => `/m/${m.id}`));
  });

  it('지우기 버튼으로도 검색어를 비운다', async () => {
    renderNav();
    expect(screen.queryByRole('button', { name: '지우기' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: '글 검색' }), 'zzqx-없음');
    await userEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByRole('searchbox', { name: '글 검색' })).toHaveValue('');
    expect(navLinks()).toEqual(MODULES.map((m) => `/m/${m.id}`));
  });
});
