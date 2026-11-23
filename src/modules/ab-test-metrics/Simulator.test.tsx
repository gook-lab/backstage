import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('A/B 실험 결과 판정 시뮬레이터', () => {
  it('매일 보고 멈추는 방식을 고르면 안내 문구가 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/기간을 14일로 미리 정하고/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '매일 보고 유의하면 멈춤' }));
    expect(screen.getByText(/한 번만 보는 것보다 잘못 찾아내는 비율이 늘어요/)).toBeInTheDocument();
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌고 결과 영역이 그대로 남는다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '결과' })).toHaveTextContent('효과 없을 때 잘못 찾아낸 실험');
  });
});
