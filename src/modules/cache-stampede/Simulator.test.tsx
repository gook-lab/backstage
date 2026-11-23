import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('캐시 스탬피드 시뮬레이터', () => {
  it('기본 일반 캐시는 만료 순간 동시 조회 경고를 띄우고, 요청 병합으로 바꾸면 경고가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(await screen.findByText(/DB 조회가 50개 동시에 나갔어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '요청 병합' }));
    expect(screen.queryByText(/동시에 나갔어요/)).not.toBeInTheDocument();
  });

  it('키가 50개인 상황에서 TTL 지터를 고르면 한꺼번에 나가던 50건의 조회가 줄어든다', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    fireEvent.change(screen.getByLabelText(/키 개수/), { target: { value: '50' } });
    expect(await screen.findByText(/DB 조회가 50개 동시에 나갔어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'TTL 지터' }));
    expect(screen.queryByText(/DB 조회가 50개 동시에 나갔어요/)).not.toBeInTheDocument();
  });
});
