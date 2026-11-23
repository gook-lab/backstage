import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const flag = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });

describe('타임아웃과 풀 시뮬레이터', () => {
  it('기본값은 프록시가 DB 보다 먼저 504 를 내고, 그 뒤에도 DB 작업이 실행된다고 알려 준다', () => {
    render(<Simulator />);
    expect(screen.getByText(/프록시가 먼저 504 를 내요/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /1초마다 본 대기열 길이/ })).toBeInTheDocument();
    expect(screen.getByText(/수치는 감을 잡기 위한 예시예요/)).toBeInTheDocument();
  });

  it('취소를 켜면 포기한 뒤에도 실행된 시도가 0개가 된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/실행한 시도는 [1-9]\d*개예요/)).toBeInTheDocument();
    await user.click(flag('포기하면 대기와 DB 작업도 취소해요'));
    expect(flag('포기하면 대기와 DB 작업도 취소해요')).toBeChecked();
    expect(screen.getByText(/실행한 시도는 0개예요/)).toBeInTheDocument();
  });

  it('DB 타임아웃을 프록시보다 짧게 낮추면 계층 경고가 사라진다', () => {
    render(<Simulator />);
    fireEvent.change(screen.getByLabelText(/DB statement_timeout 10초/), { target: { value: '2' } });
    expect(screen.queryByText(/프록시가 먼저 504 를 내요/)).not.toBeInTheDocument();
    expect(screen.getByText('시간 제한이 안쪽부터 끊기도록 맞춰져 있어요.')).toBeInTheDocument();
  });
});
