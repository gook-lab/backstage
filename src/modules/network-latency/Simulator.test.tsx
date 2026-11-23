import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('거리와 왕복 지연 시뮬레이터', () => {
  it('기본값은 HTTP/2 + TLS 1.3 새 연결로 1,060ms 가 걸린다고 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '첫 화면까지 시간' });
    expect(within(result).getByText('1,060ms', { selector: 'strong' })).toBeInTheDocument();
    expect(within(result).getByText('연결 설정 2왕복')).toBeInTheDocument();
  });

  it('직렬 요청으로 바꾸면 요청 수만큼 왕복이 늘어나 1,340ms 가 돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /같은 단계 요청을 한꺼번에 보내기/ }));

    const result = screen.getByRole('region', { name: '첫 화면까지 시간' });
    expect(within(result).getByText('1,340ms', { selector: 'strong' })).toBeInTheDocument();
  });

  it('HTTP/3 와 세션 재개를 고르면 설정 단계 없이 요청 왕복만 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: 'HTTP/3 (QUIC)' }));
    await user.click(screen.getByRole('radio', { name: '세션 재개' }));

    const result = screen.getByRole('region', { name: '첫 화면까지 시간' });
    expect(within(result).queryByText(/연결 설정/)).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    const selected = within(table).getByRole('row', { name: /HTTP\/3 \(QUIC\) · 세션 재개/ });
    expect(selected).toHaveAttribute('data-selected', 'true');
  });

  it('엣지를 켜고 적중을 끄면 엣지가 오리진까지 다녀오는 시간이 더해져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /^엣지 사용/ }));
    await user.click(screen.getByRole('checkbox', { name: /엣지에 응답이 있어요/ }));

    const result = screen.getByRole('region', { name: '첫 화면까지 시간' });
    expect(within(result).getByText('640ms', { selector: 'strong' })).toBeInTheDocument();
  });
});
