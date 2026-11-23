import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const results = () => screen.getByRole('region', { name: '결과' });

describe('실시간 공동 편집 시뮬레이터', () => {
  it('기본 전체 덮어쓰기에서는 두 화면이 서버와 같고, A의 글이 사라져요', () => {
    render(<Simulator />);
    expect(screen.getByRole('status')).toHaveTextContent('같아요');
    expect(within(results()).getByRole('table')).toHaveTextContent('사라짐');
  });

  it('위치 그대로 적용은 두 화면을 갈라놓고, 위치 변환으로 바꾸면 같아져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '위치 그대로 적용' }));
    expect(screen.getByRole('status')).toHaveTextContent('서로 달라요');

    await user.click(screen.getByRole('radio', { name: '위치 변환 (OT)' }));
    expect(screen.getByRole('status')).toHaveTextContent('같아요');
    expect(within(results()).getByRole('table')).not.toHaveTextContent('사라짐');
  });

  it('B가 먼저 도착하면 전체 덮어쓰기에서 B의 글이 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'B 가 먼저 도착' }));
    expect(within(results()).getAllByText('사라짐')).toHaveLength(3);
  });
});
