import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('여러 서비스 주문 시뮬레이터', () => {
  it('보상 없이 재고가 부족하면 어긋남을 보여 주고, 보상을 켜면 일관됨으로 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const verdict = screen.getByRole('status');
    expect(verdict).toHaveTextContent('주문이 처리 중에 멈췄어요');

    await user.click(screen.getByRole('radio', { name: '보상 있음' }));
    expect(verdict).toHaveTextContent('모든 서비스가 같은 결론이에요');
    expect(verdict).not.toHaveTextContent('어긋남');
  });

  it('응답만 유실된 보상을 멱등하지 않게 재시도하면 중복 환불이 보인다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '보상 + 재시도' }));
    await user.click(screen.getByRole('radio', { name: '처리됐지만 응답 유실' }));
    await user.click(screen.getByRole('checkbox', { name: /보상 작업을 멱등하게 만들어요/ }));
    expect(screen.getByRole('status')).toHaveTextContent('환불이 결제보다 많이 나갔어요 (중복 환불)');
    expect(screen.getByRole('region', { name: '실행 기록' })).toHaveTextContent('같은 작업을 한 번 더 적용');
  });
});
