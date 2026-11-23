import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const flag = (question: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });

const longestRow = () => document.querySelector('[data-longest="true"]');

describe('관측성 시뮬레이터', () => {
  it('기본 설정에서는 외부 결제 호출이 워터폴에서 가장 긴 구간이에요', () => {
    render(<Simulator />);
    expect(longestRow()?.textContent).toContain('외부 결제 API 호출');
  });

  it('N+1 을 켜면 상품 조회 막대가 12개로 늘어나요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    expect(screen.queryAllByText(/^DB · 상품 \d+ 조회$/)).toHaveLength(0);

    await user.click(flag('N+1 쿼리가 있나요?'));
    expect(screen.getAllByText(/^DB · 상품 \d+ 조회$/)).toHaveLength(12);
  });

  it('응답이 크면 워터폴의 가장 긴 구간이 직렬화로 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(flag('응답이 큰가요?'));
    expect(longestRow()?.textContent).toContain('응답 직렬화 · 전송');
  });

  it('이 응답이 붙이는 Server-Timing 예시를 보여 줘요', () => {
    render(<Simulator />);
    expect(screen.getByText(/Server-Timing: db;dur=/)).toBeInTheDocument();
  });
});
