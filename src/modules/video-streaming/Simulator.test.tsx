import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('동영상 재생 시뮬레이터', () => {
  it('기본값은 흔들리는 연결에서 원본 하나를 틀고 멈춤을 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '재생 결과' });

    expect(within(result).getByText(/재생이 \d+번 멈췄어요\./)).toBeInTheDocument();
    expect(within(result).getByText('수치는 감을 잡기 위한 예시예요.')).toBeInTheDocument();
  });

  it('전달 방식을 적응형으로 바꾸면 멈추지 않고 재생해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '재생 결과' });

    await user.click(screen.getByRole('radio', { name: '적응형' }));
    await user.click(screen.getByRole('radio', { name: '흔들리는 모바일 연결' }));
    expect(within(result).getByText('멈추지 않고 재생했어요.')).toBeInTheDocument();
    expect(within(result).getByText(/끝까지 재생했어요\./)).toBeInTheDocument();
  });

  it('네트워크를 바꾸면 고정 화질의 결과 표가 함께 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '고정 화질 세그먼트' }));
    await user.click(screen.getByRole('radio', { name: '안정적인 연결' }));
    const result = screen.getByRole('region', { name: '재생 결과' });
    expect(within(result).getByText('멈추지 않고 재생했어요.')).toBeInTheDocument();
    expect(within(result).getByRole('table')).toBeInTheDocument();
  });
});
