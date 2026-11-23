import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('날짜 · 시간대 시뮬레이터', () => {
  it('기본값은 오프셋 없는 문자열이라 보는 사람마다 다른 순간을 가리킨다고 알려 줘요', () => {
    render(<Simulator />);
    const panel = screen.getByRole('region', { name: '이벤트 표시' });

    expect(within(panel).getByText('2026-03-08T10:00:00')).toBeInTheDocument();
    expect(within(panel).getByText('작성자가 뜻한 순간과 달라요.')).toBeInTheDocument();
    expect(within(panel).getByText('2026-03-08T14:00:00Z')).toBeInTheDocument();
  });

  it('UTC 문자열로 바꾸면 보는 사람과 상관없이 작성자가 뜻한 순간과 같다고 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const panel = screen.getByRole('region', { name: '이벤트 표시' });

    await user.click(screen.getByRole('radio', { name: 'UTC 문자열 (…Z)' }));
    expect(within(panel).getByText('작성자가 뜻한 순간과 같아요.')).toBeInTheDocument();
    // 서버가 보낸 값과 보는 사람이 해석한 순간이 같은 문자열로 나와요
    expect(within(panel).getAllByText('2026-03-08T01:00:00Z')).toHaveLength(2);
  });

  it('예약을 처음 날 오프셋으로 고정하면 서머타임 날 발송이 10시로 밀려요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const schedule = screen.getByRole('region', { name: '예약 발송' });

    await user.click(screen.getByRole('radio', { name: '처음 날 오프셋 고정' }));
    expect(within(schedule).getByRole('cell', { name: '2026-03-08 10:00' })).toBeInTheDocument();
    expect(within(schedule).getAllByRole('cell', { name: '24시간' })).toHaveLength(2);
  });

  it('시간대 이름으로 예약하면 서머타임 전환 날 간격이 23시간이 돼요', () => {
    render(<Simulator />);
    const schedule = screen.getByRole('region', { name: '예약 발송' });

    expect(within(schedule).getByRole('cell', { name: '2026-03-08 09:00' })).toBeInTheDocument();
    expect(within(schedule).getByRole('cell', { name: '23시간' })).toBeInTheDocument();
  });
});
