import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('위치 기반 검색 시뮬레이터', () => {
  it('기본값은 전체 스캔이라 검사한 점 수가 가짜 점 수와 같아요', () => {
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });
    expect(results).toHaveTextContent(/검사한 점\D*500/);
  });

  it('격자 셀 방식을 고르면 셀 검사 설명이 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '격자 셀 인덱스' }));
    expect(screen.getByText(/상자와 겹치는 격자 셀의 점을 먼저 가져와요/)).toBeInTheDocument();
  });

  it('줌이 낮아 응답 상한을 넘으면 잘림을 알리고, 묶기를 켜면 알림이 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByRole('slider', { name: /줌 9/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('나머지');

    await user.click(screen.getByRole('checkbox', { name: /^줌이 낮으면 서버에서 묶어서 보내기/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const results = screen.getByRole('region', { name: '결과' });
    expect(within(results).getByText('응답으로 돌려준 것')).toBeInTheDocument();
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
  });
});
