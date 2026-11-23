import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('에러 응답 시뮬레이터', () => {
  it('기본값은 problem+json 이라 입력칸 3곳에 오류를 붙여요', () => {
    render(<Simulator />);
    expect(screen.getByText('올바른 이메일 형식이 아니에요')).toBeInTheDocument();
    expect(screen.getByText('8자 이상이어야 해요')).toBeInTheDocument();
    expect(screen.getByText('닉네임을 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByText(/pointer로 칸을 찾아 입력칸 3곳/)).toBeInTheDocument();
    expect(screen.getByText('수치는 감을 잡기 위한 예시예요.')).toBeInTheDocument();
  });

  it('텍스트 한 줄로 바꾸면 칸 옆 오류가 사라지고 일반 메시지만 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '텍스트 한 줄 (상태 코드만)' }));
    expect(screen.queryByText('8자 이상이어야 해요')).not.toBeInTheDocument();
    expect(screen.getByText('입력을 확인해 주세요')).toBeInTheDocument();
    expect(screen.getByText(/칸별 오류가 없어요/)).toBeInTheDocument();
  });

  it('200 에러 문자열로 서버가 바빠 거절하면 재시도 버튼이 없어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '200 + 에러 문자열' }));
    await user.click(screen.getByRole('radio', { name: '서버가 바빠서 잠시 거절' }));
    expect(screen.getByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.getByText(/상태 코드가 200이라 실패를 알 수 없어요/)).toBeInTheDocument();
  });

  it('problem+json 으로 서버가 바빠 거절하면 재시도 버튼과 요청 번호가 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '서버가 바빠서 잠시 거절' }));
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByText('req-7f3a2c')).toBeInTheDocument();
  });
});
