import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('실시간 랭킹 시뮬레이터', () => {
  it('구간별 근사로 바꾸면 내 순위가 범위로 나오고, 정확한 방식에서는 한 자리 순위가 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: 'DB COUNT' }));
    expect(within(results).getByText('내 순위')).toBeInTheDocument();
    expect(within(results).getByText('읽는 항목 수 (예시)')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '구간별 근사' }));
    expect(screen.getByRole('status')).toHaveTextContent('근사 구간이라 실제 순위는');
  });

  it('이름 순 규칙으로 바꾸면 동점 규칙 설명이 바뀌고, 다른 모임으로 돌리면 시드가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '이름 순 (Redis 기본)' }));
    expect(screen.getByText(/같은 점수면 이름 순서로 정해져요/)).toBeInTheDocument();

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 모임으로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});
