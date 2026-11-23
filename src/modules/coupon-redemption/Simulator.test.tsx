import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('쿠폰 적용 시뮬레이터', () => {
  it('두 탭 사건에서 확인 후 쓰기는 1인 1회 위반을, 유일 제약은 이미 사용 거절을 보여 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '한 사용자가 두 탭에서 동시에 사용' }));
    expect(within(results).getByText('1인 1회 위반')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('거절 · 이미 사용');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '확인 후 쓰기' }));
    expect(screen.getByRole('status')).toHaveTextContent('같은 사용자가 쿠폰을 1번 더 썼어요.');
  });

  it('쿠폰 1장에 10명이 몰리면 확인 후 쓰기는 초과 할인을 알리고, 유일 제약 + 조건부 차감은 한 명만 확정해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '남은 쿠폰에 10명이 동시에 요청' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '결과' })).toHaveTextContent('할인 적용 횟수');

    await user.click(screen.getByRole('radio', { name: '확인 후 쓰기' }));
    expect(screen.getByRole('status')).toHaveTextContent('재고보다 9장 많이 할인됐어요.');
  });
});
