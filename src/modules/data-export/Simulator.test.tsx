import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('대용량 내보내기 시뮬레이터', () => {
  it('기본값인 10만 건 메모리 방식은 504 로 끊기고, 스트리밍으로 바꾸면 알림이 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByRole('status')).toHaveTextContent('504');
    await user.click(screen.getByRole('radio', { name: '스트리밍 응답' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '결과' })).toHaveTextContent('400 ms');
  });

  it('셀 값이 수식으로 시작하면 위험으로 표시하고, 작은 따옴표 방식을 고르면 보낼 값이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText('위험')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '작은 따옴표 붙이기' }));
    expect(screen.getByText("'=1+2")).toBeInTheDocument();
  });
});
