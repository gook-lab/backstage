import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const range = (name: RegExp) => screen.getByRole('slider', { name });

describe('샤드 키 분할 시뮬레이터', () => {
  it('기본값은 샤드 키가 없는 최신순 목록이라 모든 샤드에 물어요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '조회 결과' });

    expect(within(result).getByText('샤드 키 조건이 없어 4개 샤드 모두에 물어요')).toBeInTheDocument();
    expect(within(result).getByText('80건')).toBeInTheDocument();
  });

  it('회원 한 명의 조회를 고르면 샤드 한 곳에서 끝나요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '조회 결과' });

    await user.click(screen.getByRole('radio', { name: '회원 한 명의 최신 주문 20건' }));
    expect(within(result).getByText('샤드 키 조건이 있어 1개 샤드에서 끝나요')).toBeInTheDocument();
  });

  it('범위 분할에서 최근 가입 회원 주문이 90%면 마지막 샤드가 쏠려요', () => {
    const { container } = render(<Simulator />);
    fireEvent.change(range(/최근 가입 회원 주문 비율/), { target: { value: '90' } });

    const hot = container.querySelector('li[data-hot="true"]');
    expect(hot).not.toBeNull();
    expect(hot).toHaveTextContent('샤드 4');
    expect(screen.getByText('3.7배')).toBeInTheDocument();
  });

  it('해시 분할로 바꾸면 같은 조건의 3.7배 쏠림이 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '해시 분할 (해시 값을 샤드 수로 나누기)' }));
    fireEvent.change(range(/최근 가입 회원 주문 비율/), { target: { value: '90' } });
    expect(screen.queryByText('3.7배')).not.toBeInTheDocument();
  });

  it('샤드를 4개에서 5개로 늘리면 나머지 방식은 80%, 일관 해싱은 20% 를 옮겨요', () => {
    render(<Simulator />);

    expect(screen.getByText('샤드 4 → 5 로 늘릴 때 옮기는 키 (예시)')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('최신순이 아닌 조회에서는 페이지 조절을 막아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(range(/최신순 페이지/)).not.toBeDisabled();
    await user.click(screen.getByRole('radio', { name: '최근 날짜 범위 주문' }));
    expect(range(/최신순 페이지/)).toBeDisabled();
  });
});
