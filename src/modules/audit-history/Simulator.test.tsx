import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('변경 이력 시뮬레이터', () => {
  it('기본 화면은 처음 등록 한 줄과 현재 값 1,000원을 보여 줘요', () => {
    render(<Simulator />);
    const current = screen.getByRole('region', { name: '현재 상태' });
    const history = screen.getByRole('region', { name: '이력 목록' });

    expect(within(current).getByText('1,000원')).toBeInTheDocument();
    expect(within(history).getByText('처음 등록')).toBeInTheDocument();
  });

  it('현재 값만 고르면 이력이 비고, 시점 복원은 옛 값이 덮였다고 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '현재 값만' }));
    await user.click(screen.getByRole('button', { name: '가격 1,200원으로 편집' }));
    await user.click(screen.getByRole('radio', { name: /^#0 처음 등록/ }));

    expect(screen.getByText('현재 값만 남기면 이력 목록이 비어요.')).toBeInTheDocument();
    expect(screen.getByText('옛 값이 현재 값으로 덮여서 이 시점 값을 되돌릴 수 없어요.')).toBeInTheDocument();
  });

  it('앱 코드로 기록하면 DB 직접 수정이 빠지고, 그 시점 복원은 틀린 값이 돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: 'DB에서 직접 1,500원으로 수정' }));

    const current = screen.getByRole('region', { name: '현재 상태' });
    expect(within(current).getByText('1,500원')).toBeInTheDocument();
    expect(within(current).getByText('기록에서 빠진 변경이 1번 있어요.')).toBeInTheDocument();

    const restore = screen.getByRole('region', { name: '시점 복원' });
    expect(within(restore).getByText(/기록에 빠진 변경이 있어서 이 시점 값이 틀려요/)).toBeInTheDocument();
  });

  it('DB 트리거로 기록하면 같은 직접 수정도 남아서 시점 값이 맞게 복원돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'DB 트리거에서 기록' }));
    await user.click(screen.getByRole('button', { name: 'DB에서 직접 1,500원으로 수정' }));

    const restore = screen.getByRole('region', { name: '시점 복원' });
    expect(within(restore).getByText('기록으로 이 시점 값 1,500원을 맞출 수 있어요.')).toBeInTheDocument();
  });
});
