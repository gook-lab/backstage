import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';
import { METHOD_LABEL, SCENARIO_LABEL } from './model';

describe('삭제 방식 시뮬레이터', () => {
  it('기본값은 소프트 삭제 후 복구를 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });
    expect(within(result).getByText('기대한 결과예요')).toBeInTheDocument();
    expect(within(result).getByText(/글을 복구했어요/)).toBeInTheDocument();
    expect(within(result).getByText('200')).toBeInTheDocument();
  });

  it('같은 이메일 재가입 사건에서 일반 UNIQUE 소프트 삭제는 409 와 누출 없는 실패로 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: SCENARIO_LABEL.rejoin }));
    expect(within(result).getByText('요청이 실패해요')).toBeInTheDocument();
    expect(within(result).getByText('409')).toBeInTheDocument();
  });

  it('조회 조건 누락에서 부분 인덱스만 고르면 지운 글이 보인다고 경고하고, 뷰로 바꾸면 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: SCENARIO_LABEL['missing-filter'] }));
    await user.click(screen.getByRole('radio', { name: METHOD_LABEL['soft-partial'] }));
    expect(within(result).getByText('지운 데이터가 남거나 보여요')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '살아 있는 행만 보이는 뷰' }));
    expect(within(result).getByText('기대한 결과예요')).toBeInTheDocument();
  });
});
