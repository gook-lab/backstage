import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('좌석 선점 시뮬레이터', () => {
  it('읽고 나서 쓰기는 기본 시드에서 이중 예약 경고를 띄우고, 조건부 UPDATE 로 바꾸면 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(await screen.findByText(/같은 좌석이 두 사람에게 넘어갔어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '조건부 UPDATE' }));
    expect(screen.queryByText(/같은 좌석이 두 사람에게 넘어갔어요/)).not.toBeInTheDocument();
  });

  it('처음으로 돌아가면 아직 아무 좌석도 보류되지 않은 상태를 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: '처음으로' }));
    expect(screen.getByText('처음 상태예요. 모든 좌석이 비어 있어요.')).toBeInTheDocument();
    expect(screen.queryAllByText('보류 중')).toHaveLength(0);
  });
});
