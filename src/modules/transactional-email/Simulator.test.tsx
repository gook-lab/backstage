import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';
import { RESEND_NOTICE } from './model';

describe('트랜잭션 메일 시뮬레이터', () => {
  it('없는 주소를 고르면 재시도 없이 반송되고, 사용자 화면 문구는 그대로예요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '없는 주소 (550 5.1.1)' }));
    expect(within(results).getByText('반송')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '시도 기록' })).toHaveTextContent('0분 · 5yz 영구 실패');
    expect(screen.getByRole('status')).toHaveTextContent('550 5.1.1');
    expect(screen.getByLabelText('사용자 화면 문구')).toHaveTextContent(RESEND_NOTICE);
  });

  it('재시도 정책을 재시도 안 함으로 바꾸면 일시 거절은 반송이 아니라 유실로 끝나요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '재시도 안 함' }));
    expect(within(results).getByText('유실 (사용자 미통지)')).toBeInTheDocument();
    expect(screen.queryByText('반송')).not.toBeInTheDocument();
  });

  it('다시 보내기는 쿨다운 안에서 막히고, 계정이 없어도 같은 문구를 받아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '계정 없음' }));
    await user.click(screen.getByRole('button', { name: '다시 보내기' }));
    const resend = screen.getByRole('region', { name: '다시 보내기' });
    expect(within(resend).getByText(RESEND_NOTICE)).toBeInTheDocument();
    expect(screen.getByText(/실제 발송: 없음/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 보내기' }));
    expect(screen.getByText(/잠시 후 다시 보낼 수 있어요/)).toBeInTheDocument();

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: '1분 지나기' }));
    }
    await user.click(screen.getByRole('button', { name: '다시 보내기' }));
    expect(screen.getByText(/실제 발송: 없음/)).toBeInTheDocument();
    expect(screen.queryByText(/잠시 후 다시 보낼 수 있어요/)).not.toBeInTheDocument();
  });
});
