import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('실시간 알림 시뮬레이터', () => {
  it('기본 설정에서 재개 없이 끊기면 SSE 가 이벤트를 놓친다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: 'SSE' }));
    expect(screen.getByText(/SSE는 끊긴 동안의 이벤트 \d+개를 놓쳤어요/)).toBeInTheDocument();
  });

  it('재개를 켜면 같은 흐름에서 놓친 이벤트가 0개가 된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: 'SSE' }));
    await user.click(screen.getByRole('checkbox', { name: /재연결 때 놓친 구간 이어받기/ }));
    expect(screen.getByText('SSE는 이벤트를 하나도 놓치지 않았어요.')).toBeInTheDocument();
  });

  it('WebSocket 은 지연 0.0초와 클라이언트 수만큼의 열린 연결을 보여 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: 'WebSocket' }));
    expect(screen.getByText(/WebSocket: 평균 지연 0\.0초, 열린 연결 10개/)).toBeInTheDocument();
  });
});
