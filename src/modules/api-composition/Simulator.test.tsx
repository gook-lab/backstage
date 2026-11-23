import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('화면 단위 API 시뮬레이터', () => {
  it('기본값은 REST 순서대로 요청 5번, 813 ms 예요', () => {
    render(<Simulator />);
    expect(screen.getByLabelText('호출 방식', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/요청 5번/)).toBeInTheDocument();
    expect(screen.getByText(/예상 813 ms/)).toBeInTheDocument();
  });

  it('BFF 를 고르면 클라이언트 요청은 1번이고 서버 안 호출은 5번으로 남아요', async () => {
    render(<Simulator />);
    await userEvent.click(screen.getByRole('radio', { name: /BFF/ }));
    expect(screen.getByText(/요청 1번/)).toBeInTheDocument();
    expect(screen.getByText('서버 내부 호출')).toBeInTheDocument();
  });
});
