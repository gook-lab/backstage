import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('배포 버전 차이 시뮬레이터', () => {
  it('기본값은 롤링 · 바로 삭제 · 해시 미보존이고, 깨진 칸 수와 이유를 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    expect(within(result).getByText('깨진 요청이 11칸에서 나와요')).toBeInTheDocument();
    expect(within(result).getByText(/새 서버 응답에 옛 필드가 없어요/)).toBeInTheDocument();
    expect(within(result).getByText(/청크 요청이 404가 돼요/)).toBeInTheDocument();
  });

  it('확장 후 축소와 옛 해시 파일 보존을 고르면 깨진 요청이 없다고 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '확장 후 축소해요' }));
    await user.click(screen.getByRole('radio', { name: '옛 해시 파일을 남겨요' }));
    expect(within(result).getByText('옛 탭 요청이 모두 성공해요')).toBeInTheDocument();
  });

  it('해시 파일을 남겨도 바로 빼면 필드 누락이 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '옛 해시 파일을 남겨요' }));
    expect(within(result).getByText('깨진 요청이 11칸에서 나와요')).toBeInTheDocument();
    expect(within(result).getByText(/옛 탭의 청크 요청이 성공해요/)).toBeInTheDocument();
  });

  it('블루-그린을 고르면 칸 2부터 전환된 요청이 모두 새 버전으로 가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '블루-그린' }));
    const table = screen.getByRole('table', { name: '칸별 옛 탭 요청 결과 (예시)' });
    const newRow = within(table).getByRole('row', { name: /새 버전 응답/ });
    expect(within(newRow).getAllByRole('cell')[1]).toHaveTextContent('0%');
    expect(within(newRow).getAllByRole('cell')[2]).toHaveTextContent('100%');
  });
});
