import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('시간 예약 시뮬레이터', () => {
  it('기본 값은 확인 없이 두 요청을 저장해서 겹친 예약 경고를 띄운다', () => {
    render(<Simulator />);

    expect(screen.getByText(/같은 시간에 예약이 두 개 저장됐어요/)).toBeInTheDocument();
    expect(screen.getByText(/요청 B · 14:30~15:30 저장됐어요 \(201\)/)).toBeInTheDocument();
  });

  it('배제 제약으로 바꾸면 두 번째 요청이 409 로 막히고 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '배제 제약' }));
    expect(screen.queryByText(/같은 시간에 예약이 두 개 저장됐어요/)).not.toBeInTheDocument();
    expect(screen.getByText(/배제 제약 위반 \(23P01\) → 409/)).toBeInTheDocument();
  });

  it('두 요청을 순서대로 보내면 확인 후 삽입도 두 번째 요청을 409 로 막는다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '확인 후 삽입' }));
    await user.click(screen.getByRole('radio', { name: '첫 요청이 끝난 뒤 두 번째 요청' }));
    expect(screen.queryByText(/같은 시간에 예약이 두 개 저장됐어요/)).not.toBeInTheDocument();
    expect(screen.getByText(/확인할 때 겹치는 예약이 있었어요/)).toBeInTheDocument();
  });
});
