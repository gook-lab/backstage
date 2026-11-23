import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('요청 제한 시뮬레이터', () => {
  it('기본값인 창 경계 패턴의 고정 창은 한도의 두 배가 처리됐다고 알려 준다', () => {
    render(<Simulator />);
    expect(
      screen.getByText('고정 창: 요청 10개 중 10개 통과, 0개 429. 1초 구간 최대 처리 10개(약속 5개).'),
    ).toBeInTheDocument();
    expect(screen.getByText(/약속한 5개를 넘는 10개가 처리됐어요/)).toBeInTheDocument();
  });

  it('슬라이딩 로그로 바꾸면 같은 패턴에서 한도만큼만 처리된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '슬라이딩 로그' }));
    expect(screen.getByText('1초 구간 최대 처리량이 약속한 5개 안에 있어요.')).toBeInTheDocument();
  });

  it('서버 2대가 카운터를 각자 가지면 고른 흐름에서 약속을 넘긴다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '고른 흐름 (약속의 1.5배)' }));
    await user.click(screen.getByRole('radio', { name: '서버 2대 · 카운터 각자' }));
    expect(screen.getByText(/약속한 5개를 넘는 8개가 처리됐어요/)).toBeInTheDocument();
  });
});
