import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const stat = (label: string) => screen.getByText(label).nextElementSibling;

describe('메시지 큐 재처리 시뮬레이터', () => {
  it('ack 가 유실되는 상황에서 멱등 처리를 끄면 포인트가 두 번 지급되고, 켜면 한 번으로 줄어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'ack 유실 50% · 멱등 처리 끔' }));
    expect(stat('두 번 이상 지급')).not.toHaveTextContent('0건');
    expect(await screen.findByText(/포인트를 두 번 이상 지급됐어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'ack 유실 50% · 멱등 처리 켬' }));
    expect(stat('두 번 이상 지급')).toHaveTextContent('0건');
    expect(stat('ack 로 완료')).toHaveTextContent('10건');
    expect(await screen.findByText(/모두 포인트를 한 번만 지급하고 ack 했어요/)).toBeInTheDocument();
  });
});
