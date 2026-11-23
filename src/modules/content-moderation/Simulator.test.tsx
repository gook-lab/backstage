import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('신고와 검수 시뮬레이터', () => {
  it('조직적 신고가 임계값을 넘으면 정상 글이 숨겨졌다고 알려 줘요', () => {
    render(<Simulator />);
    expect(screen.getByRole('status')).toHaveTextContent('정상 글이 자동으로 숨겨졌어요');
    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
  });

  it('유니크 제약을 켜면 같은 사람의 재시도가 집계에서 빠지고 막힌 수를 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('checkbox', { name: /\(신고자, 대상\) 유니크 제약 쓰기/ }));
    expect(within(results).getByText('중복 처리 수')).toBeInTheDocument();
    expect(screen.getByText(/유니크 제약이 막은 중복 신고는 16건이에요/)).toBeInTheDocument();
  });

  it('대기열 방식을 FOR UPDATE SKIP LOCKED로 바꾸면 같은 항목을 두 번 처리하지 않아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: 'FOR UPDATE SKIP LOCKED' }));
    const row = within(results).getByText('같은 항목을 두 번 처리한 수').parentElement;
    expect(row).toHaveTextContent('0');
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
  });
});
