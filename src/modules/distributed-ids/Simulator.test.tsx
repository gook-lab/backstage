import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('ID 설계 시뮬레이터', () => {
  it('UUID v4 로 바꾸면 정렬 비율이 떨어지고 JS 정밀도 항목은 해당 없음이 돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    expect(within(results).getByText('생성 순서 = 정렬 순서 (인접 쌍)')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'UUID v4 (무작위)' }));
    expect(within(results).getByText('해당 없음')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('64비트 정수는 정밀도 경고를 띄우고, 문자열로 받으라고 안내해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '64비트 정수 (예시 구조)' }));
    expect(screen.getByRole('status')).toHaveTextContent('2의 53제곱');
    expect(screen.getByRole('table')).toHaveTextContent('값이 바뀜');
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
  });
});
