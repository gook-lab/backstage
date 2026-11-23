import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('인증번호 공격 시뮬레이터', () => {
  it('기본값인 무차별 대입은 추측 10번과 맞힐 확률 0.001%를 알려 준다', () => {
    render(<Simulator />);
    expect(screen.getByText('무차별 대입: 발송 1건, 추측 10번, 맞힐 확률 0.001%.')).toBeInTheDocument();
    expect(screen.getByText('이 설정에서는 맞힐 확률이 0.001%예요.')).toBeInTheDocument();
  });

  it('재전송 반복에서 실패 횟수를 초기화하고 간격을 없애면 약 1.2%까지 올라간다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '재전송 반복 (실패 횟수 초기화 노림)' }));
    await user.click(screen.getByRole('radio', { name: '실패 횟수 초기화' }));
    await user.click(screen.getByRole('radio', { name: '간격 없음' }));
    await user.click(screen.getByRole('radio', { name: '시도 한도 없음' }));
    await user.click(screen.getByRole('radio', { name: '번호당 한도 없음' }));
    await user.click(screen.getByRole('radio', { name: 'IP당 한도 없음' }));
    expect(screen.getByText('재전송 반복: 발송 601건, 추측 12,020번, 맞힐 확률 1.2%.')).toBeInTheDocument();
  });

  it('문자 폭탄은 IP 한도 100건에서 멈추고 추측은 하지 않는다고 알려 준다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '문자 폭탄 (여러 번호에 발송 요청)' }));
    await user.click(screen.getByRole('radio', { name: '번호당 한도 없음' }));
    expect(screen.getByText('문자 폭탄: 발송 100건. 추측은 하지 않아요.')).toBeInTheDocument();
  });
});
