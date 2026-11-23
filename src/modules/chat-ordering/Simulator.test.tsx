import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('채팅 순서 시뮬레이터', () => {
  it('기본 설정은 서버 순번 정렬이라 모든 기기가 같은 순서를 보여요', () => {
    render(<Simulator />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('상대 1');
    expect(screen.getByRole('status')).toHaveTextContent('모든 기기가 같은 순서와 같은 안 읽은 수를 보여요.');
  });

  it('노트북 연결을 끊고 재연결 채우기를 끄면 노트북 화면에 빠진 메시지를 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('checkbox', { name: /노트북 연결 끊김/ }));
    expect(screen.getByText('노트북 화면에는 내 2 메시지가 없어요.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /재연결 뒤 마지막 순번 이후 요청/ }));
    expect(screen.queryByText('노트북 화면에는 내 2 메시지가 없어요.')).not.toBeInTheDocument();
  });

  it('처음 설정으로 돌아가면 기본 설정의 결과를 다시 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('checkbox', { name: /재전송/ }));
    expect(screen.getByText('중복 저장')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '처음 설정으로' }));
    expect(screen.getByRole('status')).toHaveTextContent('모든 기기가 같은 순서와 같은 안 읽은 수를 보여요.');
  });
});
