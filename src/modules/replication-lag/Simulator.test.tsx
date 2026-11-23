import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('복제 지연 시뮬레이터', () => {
  it('기본 무작위 복제본은 첫 목록에서 글이 빠지는 경고를 띄우고, 쓴 위치 확인으로 바꾸면 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(await screen.findByText(/저장 뒤 첫 목록에서 .* 빠졌어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '쓴 위치 확인' }));
    expect(screen.queryByText(/저장 뒤 첫 목록에서 .* 빠졌어요/)).not.toBeInTheDocument();
  });

  it('비교 표에서 쓴 위치 확인 행은 첫 목록 미노출과 뒤로 간 횟수가 모두 0이에요', () => {
    render(<Simulator />);

    const row = screen.getByRole('row', { name: /쓴 위치 확인/ });
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('0%');
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('0회');
  });

  it('지연을 짧게 줄이면 기본 무작위 방식에서도 경고가 사라진다', async () => {
    render(<Simulator />);

    fireEvent.change(screen.getByLabelText(/복제 평균 지연/), { target: { value: '50' } });
    expect(screen.queryByText(/저장 뒤 첫 목록에서 .* 빠졌어요/)).not.toBeInTheDocument();
  });
});
