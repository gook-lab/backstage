import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('N+1 시뮬레이터', () => {
  it('기본값은 N+1 로 글 10개를 가져오면 쿼리 11번이에요', () => {
    render(<Simulator />);
    expect(screen.getByLabelText('조회 방식', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/쿼리 11번/)).toBeInTheDocument();
  });

  it('JOIN 을 고르면 쿼리는 1번으로 줄고, IN 묶음에서는 묶음 수만큼 나뉜다', async () => {
    render(<Simulator />);
    await userEvent.click(screen.getByRole('radio', { name: /JOIN/ }));
    expect(screen.getByText(/쿼리 1번/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /IN 묶음/ }));
    expect(screen.getByText(/쿼리 3번/)).toBeInTheDocument();
  });
});
