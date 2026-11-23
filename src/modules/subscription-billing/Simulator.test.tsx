import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('구독 결제 시뮬레이터', () => {
  it('기본 값은 베이직에서 프로로 16일째 올리는 예시이고, 즉시 청구 차액 5,000원을 보여 줘요', () => {
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '플랜 변경 결과' });

    expect(within(results).getByText('5,000원')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /금액 계산 내역/ })).toHaveTextContent('-4,950원');
  });

  it('다음 청구서에 넣기로 바꾸면 이번 청구는 0원이고 다음 청구서에 차액이 더해져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '다음 청구서에 넣기' }));
    const results = screen.getByRole('region', { name: '플랜 변경 결과' });
    expect(within(results).getByText('24,900원')).toBeInTheDocument();
    expect(screen.queryByText('5,000원')).not.toBeInTheDocument();
  });

  it('결제 실패 기본 값은 유예 3일이라 3일째부터 기능이 막혀요', () => {
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결제 실패 결과' });

    expect(within(results).getByText('3일째')).toBeInTheDocument();
    expect(screen.getByText(/청구 시도는 0일 · 1일 · 3일 · 6일이에요/)).toBeInTheDocument();
  });

  it('재시도 없음을 고르면 재시도 결과 선택지가 모두 실패 하나만 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '재시도 없음' }));
    expect(screen.queryByRole('radio', { name: '2번째 재시도에서 성공' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '모두 실패' })).toBeChecked();
  });

  it('두 번째 재시도에서 성공하면 그날부터 active 로 돌아가고, 날짜 보기에서 열림으로 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '2번째 재시도에서 성공' }));
    expect(screen.getByText(/3일째에 결제가 되어 active 로 돌아가요/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/일째 보기/), { target: { value: '5' } });
    expect(screen.getByText('정상 (active)')).toBeInTheDocument();
    expect(screen.getByText('열림')).toBeInTheDocument();
  });

  it('유예가 끝난 날짜를 보면 기능 접근이 막힘으로 나와요', () => {
    render(<Simulator />);

    fireEvent.change(screen.getByLabelText(/일째 보기/), { target: { value: '4' } });
    expect(screen.getByText('막힘')).toBeInTheDocument();
    expect(screen.getByText('결제 밀림 (past_due)')).toBeInTheDocument();
  });
});
