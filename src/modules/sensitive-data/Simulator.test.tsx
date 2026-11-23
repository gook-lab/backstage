import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('민감 정보 누출 시뮬레이터', () => {
  it('기본 상태는 토큰이 다섯 곳에 남는다고 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '저장소별 결과' });

    expect(within(result).getByText('민감한 값이 저장소 여러 곳에 남아요')).toBeInTheDocument();
    expect(within(result).getByText('토큰이 남는 저장소는 5곳이에요.')).toBeInTheDocument();
  });

  it('모두 맞춘 예시를 고르면 남는 저장소가 없다고 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '저장소별 결과' });

    await user.click(
      screen.getByRole('radio', { name: '본문 전송 · 마스킹 · 에러 정리 · 분석 설계 · Referrer-Policy' }),
    );
    expect(within(result).getByText('민감한 값이 남는 저장소가 없어요')).toBeInTheDocument();
    expect(within(result).getByText('토큰이 남는 저장소는 0곳이에요.')).toBeInTheDocument();
  });

  it('토큰을 본문으로 옮기면 접근 로그 행에서 값이 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '저장소별 결과' });

    const tokenGroup = screen.getByRole('radiogroup', { name: /^토큰/ });
    await user.click(within(tokenGroup).getByRole('radio', { name: '요청 본문' }));
    const accessRow = within(result).getByRole('row', { name: /서버 · 프록시 접근 로그/ });
    expect(within(accessRow).getByText('남지 않아요')).toBeInTheDocument();
  });
});
