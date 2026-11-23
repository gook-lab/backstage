import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MODULES } from '../modules';
import { routes } from '../routes';

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('로드맵', () => {
  it('모듈을 순서대로 보여 주고 카드를 누르면 글로 간다', async () => {
    renderAt('/');
    const cards = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/m/'));
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
