import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('주문 상태 전이 시뮬레이터', () => {
  it('동시 요청을 서버 확인 후 쓰기로 돌리면 잘못된 전이 경고가 뜨고, 조건부 UPDATE 로 바꾸면 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '서버 확인 후 쓰기' }));
    expect(screen.getByRole('status')).toHaveTextContent('허용되지 않은 전이가 1건');
    expect(within(results).getByText('잘못된 전이')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '조건부 UPDATE' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('409 Conflict');
  });

  it('배송 중 취소를 화면에서만 막는 방식으로 두면 200 을 받고 기록에 허용 안 됨 표시가 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '배송 중에 취소 요청' }));
    await user.click(screen.getByRole('radio', { name: '화면에서만 막기' }));
    expect(screen.getByRole('table')).toHaveTextContent('200');
    expect(screen.getByRole('region', { name: '전이 이력' })).toHaveTextContent('허용 안 됨');
  });
});
