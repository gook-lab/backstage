import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const flag = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });

/** 통계 칸은 dt 라벨 옆 dd 값으로 확인해요 */
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;

describe('로그인 유지 시뮬레이터', () => {
  it('기본값은 각자 갱신이고, 갱신 요청이 요청 수만큼 나가요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '갱신 결과' });

    expect(within(result).getByText('모든 요청이 성공해요')).toBeInTheDocument();
    expect(stat('갱신 요청')).toHaveTextContent('4번');
  });

  it('회전과 재사용 감지를 켜고 각자 갱신하면 세션이 끊겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '갱신 결과' });

    await user.click(flag('리프레시 토큰을 회전해요'));
    await user.click(flag('무효화된 토큰이 다시 오면 세션을 끊어요'));
    expect(within(result).getByText('세션이 끊겨서 로그아웃돼요')).toBeInTheDocument();
    expect(within(result).getByText('강제 종료')).toBeInTheDocument();
  });

  it('갱신을 하나로 묶으면 갱신 요청은 한 번이고 모든 요청이 성공해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '갱신 결과' });

    await user.click(screen.getByRole('radio', { name: '하나로 묶어 갱신' }));
    await user.click(flag('리프레시 토큰을 회전해요'));
    await user.click(flag('무효화된 토큰이 다시 오면 세션을 끊어요'));
    expect(within(result).getByText('모든 요청이 성공해요')).toBeInTheDocument();
    expect(stat('갱신 요청')).toHaveTextContent('1번');
    expect(stat('원래 요청')).toHaveTextContent('성공 4 · 실패 0');
  });

  it('회전을 끄면 재사용 감지는 선택할 수 없어요', () => {
    render(<Simulator />);
    expect(flag('무효화된 토큰이 다시 오면 세션을 끊어요')).toBeDisabled();
  });
});
