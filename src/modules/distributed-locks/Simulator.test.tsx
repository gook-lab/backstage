import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('분산 락 시뮬레이터', () => {
  it('락이 없으면 두 서버 동시 실행에서 정산이 두 번 저장됐다고 알려 줘요', async () => {
    render(<Simulator />);

    expect(await screen.findByText('정산이 2번 저장됐어요. 같은 작업이 두 번 반영된 거예요.')).toBeInTheDocument();
  });

  it('Redis 락으로 바꾸면 한 번만 저장되고, 나중 서버는 락 실패로 건너뛰어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Redis 락 · 값 비교 해제' }));
    expect(screen.getByText('정산은 한 번만 저장됐어요.')).toBeInTheDocument();
    expect(screen.getByText(/락이 잡혀 있어요 \(보유자 A1\)/)).toBeInTheDocument();
  });

  it('해제를 DEL로 하는 방식에서 남의 락 삭제 경고를 기록에 남겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Redis 락 · 해제를 DEL로' }));
    await user.click(screen.getByRole('radio', { name: '락 해제 시 남의 락 삭제' }));
    const log = screen.getByLabelText('이벤트 기록');
    expect(within(log).getAllByText(/남의 락을 지운 거예요/)).toHaveLength(2);
  });
});
