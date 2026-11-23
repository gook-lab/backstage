import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('트랜잭션 시뮬레이터', () => {
  it('데드락 시나리오를 추천 순서대로 누르면 대기 관계가 보이고 데드락을 알린 뒤 한 트랜잭션을 중단한다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: /데드락/ }));
    for (const id of ['A', 'B', 'A']) {
      await user.click(screen.getByRole('button', { name: `${id} 한 걸음 진행` }));
    }
    expect(screen.getByText('A 가 B 를 기다려요 (재고 락)')).toBeInTheDocument();
    expect(screen.queryByText(/데드락을 감지/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'B 한 걸음 진행' }));

    expect(await screen.findByText(/데드락을 감지/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B 한 걸음 진행' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'A 한 걸음 진행' })).toBeEnabled();
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('데드락이에요');
  });
});
