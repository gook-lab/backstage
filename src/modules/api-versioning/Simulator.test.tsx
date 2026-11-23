import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('API 버전 · 폐기 시뮬레이터', () => {
  it('기본값은 Sunset 이 지난 95일째라서 차단 경고를 띄우고, 알림만 고르면 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/차단 응답을 받아요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '알림만' }));
    expect(screen.queryByText(/차단 응답을 받아요/)).not.toBeInTheDocument();
  });

  it('처음으로 돌아가면 아직 알림이 없는 상태를 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('button', { name: '처음으로' }));
    expect(screen.getByText(/아직 알림이 없어요/)).toBeInTheDocument();
  });
});
