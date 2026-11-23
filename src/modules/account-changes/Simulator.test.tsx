import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('계정 변경 공격 시뮬레이터', () => {
  it('기본값은 재인증 없이 바뀌어서 공격자가 가져가고 되돌릴 수 없다고 알려 준다', () => {
    render(<Simulator />);
    expect(
      screen.getByText('공격자가 새 주소로 계정을 가져가요. 옛 주소 알림이 없어서 되돌릴 수 없어요.'),
    ).toBeInTheDocument();
  });

  it('현재 비밀번호를 받으면 공격자는 변경 요청에서 막힌다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /현재 비밀번호를 다시 받아요/ }));
    expect(screen.getByText('재인증에서 막혀요. 공격자는 변경 요청을 할 수 없어요.')).toBeInTheDocument();
  });

  it('대기 상태만으로는 공격자가 확인 링크를 눌러 계정을 가져간다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /새 주소는 확인 링크를 누르기 전까지 대기해요/ }));
    expect(
      screen.getByText(
        '공격자가 새 주소로 계정을 가져가요. 확인 링크도 공격자 주소로 가서 대기만으로는 막히지 않아요. 옛 주소 알림이 없어서 되돌릴 수 없어요.',
      ),
    ).toBeInTheDocument();
  });

  it('같은 주소를 두 계정이 요청할 때 미리 검사하면 계정 존재가 드러난다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '같은 새 이메일을 두 계정이 동시에 요청' }));
    expect(screen.getByText('요청 응답이 "사용 중"이라고 알려서 계정 존재가 드러나요.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /요청 때 미리 검사하지 않고 확정 때만 검사해요/ }));
    expect(screen.getByText('요청 응답은 같아요. 확정 때 한 계정만 주소를 얻어요.')).toBeInTheDocument();
  });
});
