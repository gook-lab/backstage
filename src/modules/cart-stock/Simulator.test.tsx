import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('장바구니와 재고 시뮬레이터', () => {
  it('결제 확정 때 읽고 나서 쓰면 초과 판매가 생기고, 원자적 UPDATE 로 바꾸면 0 이 된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '결제가 확정될 때 차감' }));
    await user.click(screen.getByRole('radio', { name: '읽고 나서 쓰기' }));
    expect(within(results).getByText('초과 판매')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('재고보다 2개 많아요');

    await user.click(screen.getByRole('radio', { name: '원자적 UPDATE' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(results).getByText('팔린 수량 / 재고')).toBeInTheDocument();
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌고 손님 결과 표가 함께 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('구매 완료');
  });
});
