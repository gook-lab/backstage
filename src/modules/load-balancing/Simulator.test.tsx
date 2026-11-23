import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('로드밸런서 배포 시뮬레이터', () => {
  it('기본 설정은 종료 중인 서버의 503을 보여 주고 502는 없다고 알려요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    expect(within(result).getByText('200 168개 · 502 0개 · 503 12개')).toBeInTheDocument();
    expect(within(result).getByText(/첫 실패 원인: 종료 중인 서버가 새 요청을 거절했어요/)).toBeInTheDocument();
  });

  it('바로 종료를 고르면 처리 중이던 요청이 502로 끊겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '바로 종료' }));
    expect(within(result).getByText('200 166개 · 502 14개 · 503 0개')).toBeInTheDocument();
  });

  it('종료 신호 전에 기다리기를 고르면 배포 중 실패 응답이 없다고 알려요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '종료 신호 전에 기다리기' }));
    expect(
      within(result).getByText('배포 중 실패 응답이 없어요. 모든 요청이 정상 응답을 받았어요.'),
    ).toBeInTheDocument();
  });

  it('마무리 옵션을 끄면 종료 중 거절 대신 바로 내려가는 결과로 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('checkbox', { name: /SIGTERM 뒤 마무리하고 종료/ }));
    expect(within(result).getByText('200 166개 · 502 14개 · 503 0개')).toBeInTheDocument();
  });
});
