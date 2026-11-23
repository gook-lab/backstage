import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('사용량 과금 시뮬레이터', () => {
  it('기본 설정인 1분 집계와 호출 몰림에서는 한도를 넘긴 뒤 30건이 통과한 것을 알려요', () => {
    render(<Simulator />);
    expect(screen.getByRole('status')).toHaveTextContent('한도 100건에 닿은 뒤에도 30건이 통과했어요');
  });

  it('요청마다 카운터로 바꾸면 한도 초과 알림이 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '요청마다 DB 카운터' }));
    expect(screen.queryByText(/한도 100건에 닿은 뒤에도/)).not.toBeInTheDocument();
    const results = screen.getByRole('region', { name: '결과' });
    expect(within(results).getByText('한도 초과 허용')).toBeInTheDocument();
  });

  it('월말 경계에서 도착 시각 기준을 고르면 23:59 호출이 다음 달에 들어가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '월말 23:59 이벤트가 00:01 도착' }));
    await user.click(screen.getByRole('radio', { name: '발생 시각 기준' }));
    expect(screen.getByText(/23:59:00에 보낸 호출은 이번 달 청구에 들어가요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '도착 시각 기준' }));
    expect(screen.getByText(/23:59:00에 보낸 호출은 다음 달 청구에 들어가요/)).toBeInTheDocument();
  });

  it('멱등성 키를 끄면 재전송 중복으로 한도 안인데도 호출이 막혀요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '이벤트 재전송 중복' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /멱등성 키로 같은 호출의 이벤트를 한 번만 세요/ }));
    expect(screen.getByRole('status')).toHaveTextContent('한도 안인데 16건이 막혔어요');
  });
});
