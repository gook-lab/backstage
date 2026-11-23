import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('대기실 시뮬레이터', () => {
  it('보호 없이 접속이 몰리면 처리 능력을 넘는 부하를 알려 준다', () => {
    render(<Simulator />);
    expect(screen.getByText(/처리 능력 100건을 넘는 요청이 1000건까지 몰렸어요/)).toBeInTheDocument();
  });

  it('대기실로 바꾸면 입장 속도 안에서 부하가 머문다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '대기실 · 초당 입장 제한' }));
    expect(screen.getByText('최고 부하가 처리 능력 100건 안에 머물렀어요.')).toBeInTheDocument();
    expect(screen.getByText('1,000명')).toBeInTheDocument();
  });

  it('고정 창의 경계 패턴은 약속한 한도의 두 배를 통과시킨다', () => {
    render(<Simulator />);
    expect(screen.getByText(/요청 10개 중 10개 통과, 0개 429/)).toBeInTheDocument();
    expect(screen.getByText(/약속한 5개를 넘는 10개가 통과했어요/)).toBeInTheDocument();
  });

  it('슬라이딩 로그로 바꾸면 같은 패턴에서 한도만큼만 통과한다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '슬라이딩 로그' }));
    expect(screen.getByText(/요청 10개 중 5개 통과, 5개 429/)).toBeInTheDocument();
    expect(screen.getByText('1000ms 창 안 통과는 약속한 5개 이하예요.')).toBeInTheDocument();
  });
});
