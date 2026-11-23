import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('페이지네이션 시뮬레이터', () => {
  it('새 글이 위에 들어온 뒤 offset 만 같은 글을 두 번 보여 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: '1페이지 불러오기' }));
    await user.click(screen.getByRole('button', { name: '새 글 3개 들어옴' }));
    await user.click(screen.getByRole('button', { name: '다음 페이지 불러오기' }));

    const offset = screen.getByRole('region', { name: 'offset · LIMIT / OFFSET' });
    const keyset = screen.getByRole('region', { name: 'keyset · 커서' });
    expect(within(offset).getAllByText('중복')).toHaveLength(3);
    expect(within(keyset).queryByText('중복')).not.toBeInTheDocument();
    expect(screen.getByText(/offset: 중복 3개 · 빠진 글 0개/)).toBeInTheDocument();
    expect(screen.getByText(/keyset: 중복 0개 · 빠진 글 0개/)).toBeInTheDocument();
    expect(screen.getByText('keyset 목록은 그대로예요')).toBeInTheDocument();
  });
});
