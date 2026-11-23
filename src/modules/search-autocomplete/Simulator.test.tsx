import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('검색 자동완성 시뮬레이터', () => {
  it('기본값은 낡은 응답이 최신 결과를 덮어서 틀린 검색어가 남아요', () => {
    render(<Simulator />);
    const verdict = screen.getByRole('status');
    expect(verdict).toHaveTextContent('달라요');
    expect(verdict).toHaveAttribute('data-correct', 'no');
    expect(screen.getByText(/시드 3 ·/)).toBeInTheDocument();
  });

  it('취소 방식으로 바꾸면 마지막 검색어의 결과가 남고, 취소한 요청 수가 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '취소: 새 요청을 보내면 이전 요청을 끊기' }));
    expect(screen.getByRole('status')).toHaveTextContent('낡은 응답 없이 마지막 검색어의 결과가 남았어요');
    expect(within(results).getByText('취소한 요청')).toBeInTheDocument();
  });

  it('디바운스로 바꾸면 입력 글자 수보다 적은 요청만 나가고, 간격 슬라이더가 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '입력이 멈추면 보내기 (디바운스)' }));
    expect(screen.getByRole('slider')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBeLessThan(Array.from('사과주스').length);
  });

  it('다른 지연으로 다시 돌리면 시드가 바뀌고 요청 기록 표가 함께 바뀌어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: '다른 지연으로 다시 돌리기' }));
    expect(screen.getByText(/시드 4 ·/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('보낸 시각');
  });
});
