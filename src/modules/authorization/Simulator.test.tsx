import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('인가 시뮬레이터', () => {
  it('기본값은 동료 주문 조회를 403으로 막고, 주문 내용이 없다고 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '응답' });

    expect(within(result).getByText('403 Forbidden')).toBeInTheDocument();
    expect(within(result).getByText('응답에 주문 내용이 없어요.')).toBeInTheDocument();
  });

  it('화면 숨김만 고르고 다른 조직 고객 주문을 내보내면 200과 주문 내용이 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '응답' });

    await user.click(screen.getByRole('radio', { name: '화면에서만 숨긴 주문 내보내기' }));
    expect(within(result).getByText('200 OK')).toBeInTheDocument();
    expect(within(result).getByText('주문 내용이 응답에 담겨요.')).toBeInTheDocument();
  });

  it('역할 검사만 고른 상태에서 404로 숨기기를 켜도 동료 주문 조회는 통과해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '응답' });

    await user.click(screen.getByRole('radio', { name: '역할 검사만' }));
    expect(within(result).getByText('200 OK')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /^다른 사람 주문이면 404로 숨기기/ }));
    expect(within(result).getByText('200 OK')).toBeInTheDocument();
  });

  it('역할 + 소유자 검사에서 404로 숨기기를 켜면 404가 나오고 주문이 있는지도 알려 주지 않아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '응답' });

    await user.click(screen.getByRole('checkbox', { name: /^다른 사람 주문이면 404로 숨기기/ }));
    expect(within(result).getByText('404 Not Found')).toBeInTheDocument();
    expect(within(result).getByText(/주문이 있는지도 알려 주지 않아요/)).toBeInTheDocument();
  });

  it('로그인하지 않음을 고르면 401이 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '응답' });

    await user.click(screen.getByRole('radio', { name: '로그인하지 않음' }));
    expect(within(result).getByText('401 Unauthorized')).toBeInTheDocument();
    expect(within(result).getByText('응답에 주문 내용이 없어요.')).toBeInTheDocument();
  });
});
