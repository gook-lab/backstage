import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('스키마 변경 무중단 배포 시뮬레이터', () => {
  it('한 번에 바꾸면 롤링 중 요청이 깨지고, 깨진 조합 칸이 표시돼요', () => {
    const { container } = render(<Simulator />);

    expect(screen.getByRole('status')).toHaveTextContent('요청');
    expect(screen.getByRole('status')).toHaveTextContent('깨졌어요');
    expect(container.querySelectorAll('td[data-broken="true"]').length).toBeGreaterThan(0);
  });

  it('단계별로 바꾸고 오래 열린 탭을 0% 로 두면 깨지는 요청이 없어요', async () => {
    const user = userEvent.setup();
    const { container } = render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '단계별로 바꾸기 (펼치고 옮기고 줄이기)' }));
    fireEvent.change(screen.getByLabelText(/오래 열린 탭/), { target: { value: '0' } });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelectorAll('td[data-broken="true"]')).toHaveLength(0);
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('요청 없음');
  });
});
