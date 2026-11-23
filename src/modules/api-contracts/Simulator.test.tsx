import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('API 계약 시뮬레이터', () => {
  it('기본값은 타입 단언만 쓰고 이름이 바뀐 응답이라 화면 깊은 곳에서 깨져요', () => {
    render(<Simulator />);
    expect(screen.getByText(/화면 오류: Cannot read properties of undefined/)).toBeInTheDocument();
    expect(screen.getByText(/터진 곳은 화면 깊은 곳이에요/)).toBeInTheDocument();
    expect(screen.getByText(/컴파일 단계: 서버 응답은 컴파일러가 보지 않아요/)).toBeInTheDocument();
    expect(screen.getByText('응답 값은 설명을 위한 예시예요.')).toBeInTheDocument();
  });

  it('경계 파싱으로 바꾸면 같은 응답을 화면에 들어가기 전에 멈추고 위반 칸을 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '경계 파싱' }));
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('계약 위반 때문에 값을 그리지 않았어요.')).toBeInTheDocument();
    expect(screen.queryByText(/화면 오류:/)).not.toBeInTheDocument();
  });

  it('타입 단언만 쓰고 번호가 문자열로 오면 에러 없이 다음 번호가 421 로 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '번호 타입이 바뀜' }));
    expect(screen.getByText('421')).toBeInTheDocument();
    expect(screen.getByText(/아무도 알아채지 못하는 실패예요/)).toBeInTheDocument();
    expect(screen.queryByText(/화면 오류:/)).not.toBeInTheDocument();
  });

  it('파싱 + 대체에서 새 권한 값이 오면 일반 회원으로 보여 주고 바꾼 내용을 남겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '파싱 + 모르는 권한 대체' }));
    await user.click(screen.getByRole('radio', { name: '새 권한 값 owner' }));
    expect(screen.getByText('일반 회원')).toBeInTheDocument();
    expect(screen.getByText('모르는 권한 owner 은 일반 회원으로 보여 줘요')).toBeInTheDocument();
  });
});
