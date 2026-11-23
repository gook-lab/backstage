import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const flag = (question: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${question.replace(/[?]/g, '\\?')}`) });

describe('서버 · 클라 처리 시뮬레이터', () => {
  it('기본값은 클라이언트 처리를 추천하고, 걸린 이유를 함께 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '추천' });

    expect(within(result).getByText('클라이언트에서 처리해요')).toBeInTheDocument();
    expect(within(result).getByText(/50건 안팎이고 이미 받아 둔 목록/)).toBeInTheDocument();
  });

  it('돈 · 권한 · 재고 질문에 답하면 미리보기와 서버 확정을 함께 추천해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '추천' });

    await user.click(flag('돈·권한·재고와 관련 있나요?'));
    expect(within(result).getByText('클라이언트가 미리 보여 주고, 서버가 확정해요')).toBeInTheDocument();
    expect(within(result).getByText(/돈 · 권한 · 재고는 서버가 판단하고 확정해요/)).toBeInTheDocument();
  });

  it('쿠폰 할인 예시는 비밀 규칙 때문에 미리보기 없이 서버에서만 처리하고 관련 글로 이어져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '추천' });

    await user.click(screen.getByRole('radio', { name: '쿠폰 할인 적용' }));
    expect(within(result).getByText('서버에서 처리해요')).toBeInTheDocument();
    expect(within(result).getByText(/비밀 규칙은 클라이언트에 내려 보내지 않아요/)).toBeInTheDocument();
    expect(
      within(result).getByRole('link', { name: '장바구니와 재고 — 담아 둔 상품이 품절되는 순간' }),
    ).toHaveAttribute('href', '/m/cart-stock');
  });

  it('데이터가 50만 건 이상이면 즉각 반응이 필요해도 서버에서 처리해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '추천' });

    await user.click(flag('즉각 반응이 필요한가요?'));
    await user.click(screen.getByRole('radio', { name: '50만 건 이상 · 서버에만 있어요' }));
    expect(within(result).getByText('서버에서 처리해요')).toBeInTheDocument();
  });

  it('질문에 답을 바꾸면 예시 선택은 풀리고, 추천은 답에 맞춰 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '추천' });

    await user.click(screen.getByRole('radio', { name: '장바구니 합계' }));
    expect(within(result).getByText('클라이언트가 미리 보여 주고, 서버가 확정해요')).toBeInTheDocument();

    await user.click(flag('비밀 규칙이 있나요?'));
    expect(screen.getByRole('radio', { name: '장바구니 합계' })).not.toBeChecked();
    expect(within(result).getByText('서버에서 처리해요')).toBeInTheDocument();
  });
});
