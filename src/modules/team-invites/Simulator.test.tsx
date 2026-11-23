import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('팀 초대 시뮬레이터', () => {
  it('기본값인 이메일 지정 정상 수락은 초대받은 계정이 새로 참여했다고 보여 준다', () => {
    render(<Simulator />);
    expect(screen.getByText('초대받은 계정이 들어갔어요.')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('invitee@example.com')).toBeInTheDocument();
    expect(within(table).getByText('새로 참여')).toBeInTheDocument();
  });

  it('공유 링크로 제3자가 먼저 수락하면 1회 사용이어도 제3자가 들어가고 원래 받을 사람은 거절돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '공유 링크' }));
    await user.click(screen.getByRole('radio', { name: '링크 유출 뒤 제3자 수락' }));
    expect(screen.getByText('링크를 연 계정이 들어갔어요. 링크는 받을 사람을 확인하지 않아요.')).toBeInTheDocument();
    expect(screen.getByText('이미 수락된 초대예요. 한 번만 쓸 수 있어요.')).toBeInTheDocument();
  });

  it('취소 뒤 수락을 상태 변경 없이 두면 취소 표시만 되고 링크가 계속 통한다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '취소 뒤 수락' }));
    await user.click(screen.getByRole('radio', { name: '표시만' }));
    expect(
      screen.getByText('취소 버튼을 눌렀지만 상태는 그대로예요. 이미 보낸 링크가 계속 통해요.'),
    ).toBeInTheDocument();
  });
});
