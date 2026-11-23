import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('좋아요 카운터 시뮬레이터', () => {
  it('POST 로 세면 중복 요청이 숫자를 바꾸고, PUT 으로 바꾸면 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByRole('status')).toHaveTextContent('중복 요청이 숫자를 바꿨어요');
    await user.click(screen.getByRole('radio', { name: 'PUT 으로 좋아요 상태 설정' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Redis 에 모아 둔 값은 장애가 나면 반영 전 증가분을 잃는다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Redis 에 모았다가 주기적으로 반영' }));
    await user.click(screen.getByRole('checkbox', { name: /장애 넣기/ }));
    expect(screen.getByRole('status')).toHaveTextContent('장애로 반영 전');
  });
});
