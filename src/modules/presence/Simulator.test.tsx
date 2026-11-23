import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('접속 상태 시뮬레이터', () => {
  it('기본값은 정상 종료 사건을 보여 주고, 잘못 표시된 시간을 요약해요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '잘못 표시된 시간' });

    expect(within(result).getByText('끊겼는데 온라인으로 보임')).toBeInTheDocument();
    expect(within(result).getByText('5초', { selector: 'dd' })).toBeInTheDocument();
    expect(within(result).getByText('끊겼는데 온라인으로 보인 구간: 60~64초')).toBeInTheDocument();
  });

  it('TTL을 하트비트 간격 이하로 고르면 깜빡임 경고를 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    const ttl = screen.getByRole('radiogroup', { name: 'TTL' });
    await user.click(within(ttl).getByRole('radio', { name: '30초' }));
    expect(screen.queryByText(/TTL이 하트비트 간격 이하예요/)).not.toBeInTheDocument();

    await user.click(within(ttl).getByRole('radio', { name: '15초' }));
    expect(screen.getByText(/TTL이 하트비트 간격 이하예요/)).toBeInTheDocument();
  });

  it('사건을 두 번째 기기 접속으로 바꾸고 사용자당 키를 고르면 연결됐는데 오프라인으로 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '두 번째 기기 접속' }));
    await user.click(screen.getByRole('radio', { name: '사용자당 키 하나' }));
    await user.click(screen.getByRole('radio', { name: '없음' }));
    const result = screen.getByRole('region', { name: '잘못 표시된 시간' });
    expect(within(result).getByText('연결됐는데 오프라인으로 보인 구간: 60~64초')).toBeInTheDocument();
  });
});
