import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const box = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });

describe('장애 격리 시뮬레이터', () => {
  it('기본값은 요청 수와 예시 문구를 보여 줘요', () => {
    render(<Simulator />);
    expect(screen.getByText(/사용자 요청 3000건 중 정상/)).toBeInTheDocument();
    expect(screen.getByText(/수치는 감을 잡기 위한 예시예요/)).toBeInTheDocument();
  });

  it('벌크헤드와 대체 응답을 함께 켜면 페이지 실패가 0건이 된다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(box('추천 호출에 칸을 따로 떼어 줘요'));
    await user.click(box('추천이 실패하면 빈 추천 영역으로 그려요'));
    expect(screen.getByText(/실패 0건이에요/)).toBeInTheDocument();
  });

  it('서킷 브레이커를 켜기 전에는 임계치 조절이 비활성화돼 있다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    expect(screen.getByLabelText(/실패 임계치/)).toBeDisabled();
    await user.click(box('서킷 브레이커를 켜요'));
    expect(screen.getByLabelText(/실패 임계치/)).toBeEnabled();
  });
});
