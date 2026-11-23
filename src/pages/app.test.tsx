import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MODULES } from '../modules';
import { routes } from '../routes';

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('로드맵', () => {
  it('모듈을 순서대로 보여 주고 카드를 누르면 글로 간다', async () => {
    renderAt('/');
    const cards = within(screen.getByRole('main'))
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/m/'));
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(MODULES.map((m) => `/m/${m.id}`));
    await userEvent.click(cards[0]);
    expect(await screen.findByRole('heading', { level: 1, name: MODULES[0].title })).toBeInTheDocument();
  });

  it('없는 모듈 주소는 안내를 보여 준다', () => {
    renderAt('/m/nope');
    expect(screen.getByRole('heading', { name: '찾는 글이 없어요' })).toBeInTheDocument();
  });
});

describe('판단 기준 체크', () => {
  it('체크하면 로드맵 진행 수가 늘고 새로 열어도 남는다', async () => {
    const m = MODULES.find((x) => x.checklist.length > 0);
    if (!m) throw new Error('체크리스트가 있는 모듈이 없어요');
    const { unmount } = renderAt(`/m/${m.id}`);
    await userEvent.click(await screen.findByLabelText(m.checklist[0].text));
    unmount();
    renderAt('/');
    expect(screen.getByLabelText(`판단 기준 ${m.checklist.length}개 중 1개 확인`)).toBeInTheDocument();
  });
});

describe('글 목록 · 목차 · 이전/다음', () => {
  it('왼쪽 목록이 모든 글을 담고 지금 글을 표시한다', async () => {
    const m = MODULES[1];
    renderAt(`/m/${m.id}`);
    const nav = screen.getAllByRole('navigation', { name: '글 목록' })[0];
    const links = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/m/'));
    expect(links).toHaveLength(MODULES.length);
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', `/m/${m.id}`);
  });

  it('이전 글과 다음 글로 이동할 수 있다', async () => {
    const m = MODULES[1];
    renderAt(`/m/${m.id}`);
    const pager = screen.getByRole('navigation', { name: '이전 글 · 다음 글' });
    expect(within(pager).getByRole('link', { name: new RegExp(MODULES[0].title) })).toHaveAttribute(
      'href',
      `/m/${MODULES[0].id}`,
    );
    await userEvent.click(within(pager).getByRole('link', { name: new RegExp(MODULES[2].title) }));
    expect(await screen.findByRole('heading', { level: 1, name: MODULES[2].title })).toBeInTheDocument();
  });

  it('글을 불러오면 h2 로 목차를 만든다', async () => {
    renderAt(`/m/${MODULES[0].id}`);
    const toc = await screen.findByRole('navigation', { name: '이 글의 목차' });
    expect(within(toc).getByRole('link', { name: '직접 돌려 보기' })).toHaveAttribute('href', '#lab-title');
    expect(within(toc).getAllByRole('link').length).toBeGreaterThan(3);
  });
});
