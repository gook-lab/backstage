import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';
import { simulate } from './model';

describe('로그인 공격 시뮬레이터', () => {
  it('계정 잠금을 켜면 피해자 잠금 수와 막힌 정상 로그인 수가 모델 결과와 같아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '한 계정 무차별 대입' }));
    await user.click(screen.getByRole('checkbox', { name: /^계정 잠금/ }));

    const expected = simulate({ attack: 'brute', defenses: ['lockout'], attackRate: 20, seed: 7 });
    const results = screen.getByRole('region', { name: '결과' });
    const locked = within(results).getByText('잠긴 계정 수').closest('div') as HTMLElement;
    expect(locked).toHaveTextContent(String(expected.lockedAccounts));
    expect(within(results).getByText('막힌 정상 로그인').closest('div')).toHaveTextContent(
      String(expected.legitBlocked),
    );
    expect(screen.getByRole('table')).toHaveTextContent('계정 잠금');
  });

  it('다른 시드로 다시 돌리면 시드 번호가 바뀌고 표가 함께 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
  });
});
