import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('알림함 시뮬레이터', () => {
  it('행마다 read_at 으로 모두 읽음을 누르면 안 읽은 행 수만큼 갱신된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('button', { name: '새 알림 도착' }));
    await user.click(screen.getByRole('button', { name: '모두 읽음' }));

    expect(within(results).getByText('배지와 실제의 차이')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('안 읽은 행 41개의 read_at 을 채웠어요.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('카운터에 무조건 -1 을 쓰고 두 탭이 동시에 읽으면 차이가 생기고, 다시 세기로 맞춘다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '카운터 칸 하나' }));
    await user.click(screen.getByRole('radio', { name: '무조건 -1' }));
    await user.click(screen.getByRole('button', { name: '두 탭이 맨 위 알림을 동시에 읽기' }));
    expect(screen.getByRole('status')).toHaveTextContent('배지가 실제보다 1개 적어요');

    await user.click(screen.getByRole('button', { name: '카운터 다시 세기' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
