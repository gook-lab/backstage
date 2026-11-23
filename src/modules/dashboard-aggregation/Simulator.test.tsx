import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const metric = (testId: string) => screen.getByTestId(testId).textContent;

describe('대시보드 집계 시뮬레이터', () => {
  it('기본값은 원본을 매번 읽어서 원본과 다른 점이 없다고 보여 줘요', () => {
    render(<Simulator />);
    expect(screen.getByRole('region', { name: '차트 결과' })).toBeInTheDocument();
    expect(metric('differ')).toBe('0개');
    expect(metric('read-rows')).toMatch(/행$/);
    expect(screen.getByText('수치는 감을 잡기 위한 예시예요.')).toBeInTheDocument();
  });

  it('일별 롤업으로 바꾸면 읽는 행이 줄고 오늘 점이 빠져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const before = Number(metric('read-rows')?.replace('행', ''));

    await user.click(screen.getByRole('radio', { name: '일별 롤업' }));
    expect(metric('read-rows')).toBe('89행');
    expect(metric('read-rows')).not.toBe(`${before}행`);
    expect(metric('differ')).toBe('1개');
    expect(screen.getByText(/아직 계산되지 않은 점 1개가 차트에서 빠졌어요/)).toBeInTheDocument();
  });

  it('늦게 도착한 주문을 넣으면 롤업의 틀린 날짜 수가 늘어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '롤업 + 오늘만 원본' }));
    expect(metric('differ')).toBe('0개');

    await user.click(screen.getByRole('radio', { name: '일별 롤업' }));
    await user.click(screen.getByRole('checkbox', { name: /늦게 도착한 주문 2건 넣기/ }));
    expect(metric('differ')).toBe('3개');
    expect(screen.getByText(/늦게 도착한 주문 2건은 롤업을 만든 뒤에 들어와서 빠졌어요/)).toBeInTheDocument();
  });

  it('빈 버킷을 채우면 기간의 날짜 수만큼 점이 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const chart = screen.getByRole('img', { name: '차트 막대' });
    const barsBefore = chart.children.length;
    expect(barsBefore).toBeLessThan(90);

    await user.click(screen.getByRole('checkbox', { name: /빈 버킷을 0으로 채우기/ }));
    expect(metric('point-count')).toBe('90개');
    expect(chart.children.length).toBe(90);
    expect(chart.querySelectorAll('[data-filled="true"]').length).toBeGreaterThan(0);
  });
});
