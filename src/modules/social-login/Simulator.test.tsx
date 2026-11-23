import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('소셜 로그인 시뮬레이터', () => {
  it('기본값은 인가 코드 + PKCE 정상 로그인이고, 로그인이 끝나요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '로그인 결과' });

    expect(within(result).getByText('로그인이 끝났어요')).toBeInTheDocument();
  });

  it('PKCE 없는 흐름에서 가로챈 code를 쓰면 공격이 통과해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '로그인 결과' });

    await user.click(screen.getByRole('radio', { name: 'PKCE 없음' }));
    await user.click(screen.getByRole('radio', { name: '가로챈 code 또는 토큰 사용' }));
    expect(within(result).getByText('공격이 통과했어요')).toBeInTheDocument();
  });

  it('PKCE가 있으면 같은 공격이 토큰 교환 단계에서 막혀요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '로그인 결과' });

    await user.click(screen.getByRole('radio', { name: '가로챈 code 또는 토큰 사용' }));
    expect(within(result).getByText('공격이 막혔어요')).toBeInTheDocument();
    expect(within(result).getByText('막은 검사: PKCE code_verifier 검사')).toBeInTheDocument();
  });
});
