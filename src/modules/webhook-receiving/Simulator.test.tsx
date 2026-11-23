import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const stat = (label: string) => screen.getByText(label).nextElementSibling;

describe('웹훅 수신 시뮬레이터', () => {
  it('웹훅만 받으면 두 번 처리된 주문이 있고, 중복 제거 방식으로 바꾸면 0건이 돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '웹훅만 받기' }));
    expect(stat('두 번 처리된 주문')).not.toHaveTextContent('0건');

    await user.click(screen.getByRole('radio', { name: '웹훅 + 이벤트 ID 중복 제거 + 상태 전이 검사' }));
    expect(stat('두 번 처리된 주문')).toHaveTextContent('0건');
    expect(stat('중복 웹훅 제거')).not.toHaveTextContent('0번');
  });
});
