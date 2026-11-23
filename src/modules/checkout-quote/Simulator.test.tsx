import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('결제 금액 확정 시뮬레이터', () => {
  it('가격 인상 때 견적 id + 재계산은 바뀐 항목을 보여 주고 거절하며, 다시 견적을 받으면 새 금액을 청구해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '가격 인상' }));
    await user.click(screen.getByRole('radio', { name: '견적 id + 재계산' }));
    expect(screen.getByRole('status')).toHaveTextContent('바뀐 항목 1개가 있어 거절했어요');
    expect(screen.getByRole('list')).toHaveTextContent('상품 가격 12,000원 → 13,000원');
    expect(within(results).getByText('변경으로 거절')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '바뀐 금액으로 다시 견적 받기' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(results).toHaveTextContent('26,000원');
    expect(within(results).getByText('통과')).toBeInTheDocument();
  });

  it('서버 재계산만 고르면 청구 금액은 바뀌지만 사용자에게 보여 준 변경 항목은 비어 있어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '배송비 기준 변경' }));
    await user.click(screen.getByRole('radio', { name: '서버 재계산만' }));
    expect(screen.getByRole('status')).toHaveTextContent('사용자가 본 24,000원과 다른 26,000원이 안내 없이 청구됐어요');
    expect(screen.getByText('보여 준 변경 항목이 없어요.')).toBeInTheDocument();
  });
});
