import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('금액 계산 시뮬레이터', () => {
  it('소수 계산이면 합계 차이를 알려 주고, 정수 최소 단위로 바꾸면 차이가 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    expect(screen.getByRole('status')).toHaveTextContent('1 최소 단위 달라요');
    expect(within(results).getByText('차이')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '정수 최소 단위 (BigInt)' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('계산 순서를 바꾸면 줄 금액 설명과 다른 순서와의 차이가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '정수 최소 단위 (BigInt)' }));
    await user.click(screen.getByRole('radio', { name: '반올림 (0.5 는 올려요)' }));
    expect(screen.getByText(/줄마다 반올림하면 줄 금액이 모두 정수예요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '합계 뒤에 한 번 반올림' }));
    expect(screen.getByText(/합계 뒤에 한 번만 반올림해요/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '결과' })).toHaveTextContent('다른 계산 순서와 차이');
  });

  it('통화를 바꾸면 소수 자릿수에 맞춰 단가가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '원 (KRW · 소수 0자리)' }));
    expect(screen.getByRole('table')).toHaveTextContent('₩12,900');
  });
});
