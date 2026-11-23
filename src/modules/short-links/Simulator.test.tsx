import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('짧은 링크 시뮬레이터', () => {
  it('무작위 8자로 바꾸면 코드 길이가 8자로 바뀌고, 순번은 충돌 확률 0 을 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '코드 결과' });

    await user.click(screen.getByRole('radio', { name: '무작위 8자' }));
    expect(within(results).getByText('8자')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '순번 base62' }));
    expect(within(results).getByText('0%')).toBeInTheDocument();
  });

  it('대상을 바꾸고 302 로 두면 재방문자는 새 주소로 가고, 301 로 바꾸면 옛 주소로 갈 수 있어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const verdict = screen.getByRole('status');

    expect(verdict).toHaveTextContent('옛 주소로 갈 수 있어요');
    await user.click(screen.getByRole('radio', { name: '302 임시' }));
    expect(verdict).toHaveTextContent('재방문자는 새 주소로 가요');

    await user.click(screen.getByRole('radio', { name: '301 영구' }));
    expect(verdict).toHaveTextContent('옛 주소로 갈 수 있어요');
  });

  it('대상을 바꾸지 않으면 옛 주소 문제가 없다고 알려요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('checkbox', { name: /대상 URL을 바꿨어요/ }));
    expect(screen.getByRole('status')).toHaveTextContent('옛 주소 문제가 없어요');
  });
});
