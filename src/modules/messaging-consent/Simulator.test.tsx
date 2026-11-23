import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('마케팅 동의 시뮬레이터', () => {
  it('요청 생성 시에만 확인하고 메일 동의를 끄면 동의 위반이 생겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '설정에서 메일 마케팅 끄기' }));
    expect(within(results).getByText('동의 위반')).toBeInTheDocument();
    const items = screen.getByRole('list', { name: '메시지 처리' });
    expect(within(items).getByText('메일 · 쿠폰 안내 (마케팅)').closest('li')).toHaveTextContent(
      '동의를 거둔 뒤에 나갔어요',
    );
    expect(within(items).getByText('메일 · 주문 확인 (거래)').closest('li')).toHaveTextContent(
      '거래 알림은 마케팅 동의와 상관없이 나가요',
    );
  });

  it('발송 직전에 다시 확인하면 같은 메일이 막히고 위반은 없어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '발송 직전에 다시 확인' }));
    await user.click(screen.getByRole('radio', { name: '설정에서 메일 마케팅 끄기' }));
    const items = screen.getByRole('list', { name: '메시지 처리' });
    expect(within(items).getByText('메일 · 쿠폰 안내 (마케팅)').closest('li')).toHaveTextContent(
      '발송 직전 동의가 꺼져 있어 막았어요',
    );
    expect(within(items).getByText('문자 · 이벤트 안내 (마케팅)').closest('li')).toHaveTextContent(
      '동의가 유지되어 나갔어요',
    );
  });
});
