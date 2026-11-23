import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('동시 편집 시뮬레이터', () => {
  it('조건 없이 A가 먼저 저장하면 덮어쓴 저장이 생기고, If-Match로 바꾸면 B가 412를 받는다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '둘이 먼저 읽고 A가 먼저 저장' }));
    expect(within(results).getByText('덮어쓴 저장')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('앞 수정 한 건이 사라졌어요');

    await user.click(screen.getByRole('radio', { name: 'If-Match · ETag 비교' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('412');
    expect(within(results).getByText('A의 수정')).toBeInTheDocument();
  });

  it('If-Match 를 빠뜨린 B 저장을 428 로 거절하도록 바꾸면 응답 표에 428이 나온다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'If-Match · ETag 비교' }));
    await user.click(screen.getByRole('radio', { name: '둘이 먼저 읽고 B가 먼저 저장' }));
    await user.click(screen.getByRole('checkbox', { name: 'B 의 저장이 If-Match 를 빠뜨림 (FE 버그 흉내)' }));
    await user.click(screen.getByRole('checkbox', { name: 'If-Match 없는 저장을 428로 거절' }));

    expect(screen.getByRole('table')).toHaveTextContent('428');
  });
});
