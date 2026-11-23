import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('검색 결과 정렬 시뮬레이터', () => {
  it('기본값은 동점 순서가 정해지지 않아 2페이지에서 중복이나 누락이 생겨요', () => {
    render(<Simulator />);
    const verdict = screen.getByRole('status');
    expect(verdict).toHaveAttribute('data-correct', 'no');
    expect(verdict).toHaveTextContent('중복');
  });

  it('동점 처리를 id 로 바꾸면 2페이지까지 중복과 누락이 없다고 나와요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: /동점이면 id 오름차순/ }));
    expect(screen.getByRole('status')).toHaveTextContent('중복과 누락이 없어요');
    expect(screen.getByRole('status')).toHaveAttribute('data-correct', 'yes');
  });

  it('검색 결과가 0건이면 그렇다고 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '없는단어');
    expect(screen.getByRole('status')).toHaveTextContent('결과가 0건이에요');
  });

  it('결과가 있어도 오타로 보이는 단어는 교정 후보로 따로 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '사과 쥬스');
    expect(screen.getByText(/"쥬스" 은 "주스" 의 오타일 수 있어요/)).toBeInTheDocument();
  });

  it('판매 가중치 슬라이더가 있고, 결과 표에 페이지 두 개가 나와요', () => {
    render(<Simulator />);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getByText('1 페이지')).toBeInTheDocument();
  });
});
