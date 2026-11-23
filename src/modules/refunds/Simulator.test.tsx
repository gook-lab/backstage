import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('환불과 부분 취소 시뮬레이터', () => {
  it('배분 없음을 고르면 전체 취소 환불이 결제액보다 할인액만큼 많다고 알려요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const alloc = screen.getByRole('region', { name: '주문 쿠폰 할인 배분' });
    expect(within(alloc).queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '배분 없음' }));
    expect(within(alloc).getByRole('status')).toHaveTextContent('결제액보다 5,000원 많아요');
  });

  it('방어 없이 두 환불을 동시에 처리하면 결제액을 넘고, 조건부 갱신으로 바꾸면 경고가 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByRole('status')).toHaveTextContent('누적 환불이 결제액을 7,000원 넘어요');

    await user.click(screen.getByRole('radio', { name: '조건부 갱신' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '환불 결과' })).toHaveTextContent('누적 환불액');
  });

  it('같은 요청을 두 번 보내고 멱등성 키를 고르면 두 번째 요청은 첫 결과를 돌려받아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '같은 요청 두 번 (더블 클릭)' }));
    await user.click(screen.getByRole('radio', { name: '멱등성 키' }));
    expect(screen.getByText('같은 키라 첫 결과 반환')).toBeInTheDocument();
  });
});
