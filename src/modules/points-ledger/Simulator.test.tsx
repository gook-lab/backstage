import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('포인트 원장 시뮬레이터', () => {
  it('기본 값에서 사용 취소 정책을 바꾸면 남은 잔액이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    expect(within(results).getByText('남은 잔액')).toBeInTheDocument();
    expect(within(results).getByText('4,000')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '복원 후 즉시 소멸' }));
    expect(within(results).getByText('4,000')).toBeInTheDocument();
    expect(within(results).getByText('8,000')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '유효기간 연장' }));
    expect(within(results).getByText('9,000')).toBeInTheDocument();
  });

  it('잔액이 모자라면 부족 안내를 보여 주고 사용 배분을 없음으로 보여 준다', () => {
    render(<Simulator />);

    // 40일째 쓸 수 있는 포인트는 B 5,000 + C 4,000 = 9,000P 예요
    fireEvent.change(screen.getByLabelText('사용 금액'), { target: { value: '12000' } });
    expect(screen.getByRole('status')).toHaveTextContent('사용할 수 있는 포인트가 3,000P 부족해요');
    const results = screen.getByRole('region', { name: '결과' });
    expect(within(results).getByText('없음')).toBeInTheDocument();
  });
});
