import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('목록 필터 · 정렬 시뮬레이터', () => {
  it('최신순에 created_at 인덱스를 고르면 정렬 단계 없이 20건만 읽는다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '전체' }));
    await user.click(screen.getByRole('radio', { name: '전체 기간' }));
    await user.click(screen.getByRole('radio', { name: '(created_at)' }));

    expect(screen.getByRole('status')).toHaveTextContent('정렬 단계 없음');
    const plan = screen.getByRole('region', { name: '실행 계획' });
    expect(within(plan).getByText('테이블 행 방문')).toBeInTheDocument();
  });

  it('인덱스 없이 금액순으로 바꾸면 정렬 단계가 생기고 개수 방식을 바꾸면 읽는 행이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '인덱스 없음' }));
    expect(screen.getByRole('status')).toHaveTextContent('정렬 단계 있음');

    await user.click(screen.getByRole('radio', { name: '정확한 COUNT(*)' }));
    const count = screen.getByRole('region', { name: '개수 표시' });
    expect(within(count).getByText('세려고 읽는 행')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '다음 페이지 여부만' }));
    expect(within(count).getByText('21행')).toBeInTheDocument();
  });
});
