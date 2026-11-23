import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const stat = (label: string) => screen.getByText(label).nextElementSibling;

describe('결제 멱등성 시뮬레이터', () => {
  it('응답 유실 뒤 자동 재전송을 보호 없이 돌리면 승인이 2번 나고, 멱등성 키를 켜면 1번으로 줄어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '응답 유실 · 자동 재전송 · 보호 없음' }));
    expect(stat('카드사 승인')).toHaveTextContent('2번');
    expect(await screen.findByText(/중복 결제예요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '멱등성 키' }));
    expect(stat('카드사 승인')).toHaveTextContent('1번');
    expect(stat('주문 결제 완료')).toHaveTextContent('1건');
    expect(await screen.findByText(/고객 화면은 아직 확인 중이에요/)).toBeInTheDocument();
  });
});
