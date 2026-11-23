import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('CSV 대량 가져오기 시뮬레이터', () => {
  it('행별 부분 성공으로 올리면 맞는 행만 저장하고 틀린 행의 번호와 열을 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('button', { name: '올리기' }));

    const result = screen.getByRole('region', { name: '처리 결과' });
    expect(within(result).getByText('저장 2행 · 거절 4행')).toBeInTheDocument();
    const table = within(result).getByRole('table');
    expect(within(table).getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '비어 있어요' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '2행과 같은 sku예요' })).toBeInTheDocument();
  });

  it('전체 롤백은 첫 오류에서 멈추고, 확정되지 않았다고 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '전체 롤백' }));
    await user.click(screen.getByRole('button', { name: '올리기' }));

    const result = screen.getByRole('region', { name: '처리 결과' });
    expect(within(result).getByText('확정되지 않았어요. 아무 행도 저장하지 않았어요.')).toBeInTheDocument();
    expect(within(result).getByText('첫 오류에서 멈춰서 나머지 4행은 확인하지 않았어요.')).toBeInTheDocument();
    const rows = within(within(result).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(2);
  });

  it('검증 후 확정은 오류를 모두 보여 주고 저장 목록을 비워 둬요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '검증 후 확정' }));
    await user.click(screen.getByRole('button', { name: '올리기' }));

    const result = screen.getByRole('region', { name: '처리 결과' });
    expect(within(result).getByText('확정되지 않았어요. 아무 행도 저장하지 않았어요.')).toBeInTheDocument();
    expect(within(result).getByRole('heading', { name: '저장된 행 0개' })).toBeInTheDocument();
    const rows = within(within(result).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(5);
  });

  it('업서트 키가 켜진 채 다시 올리면 새 행 없이 기존 행을 고쳐 써요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('button', { name: '올리기' }));
    await user.click(screen.getByRole('button', { name: '다시 올리기' }));

    const result = screen.getByRole('region', { name: '처리 결과' });
    expect(within(result).getByText('새로 넣은 행 0 · 고쳐 쓴 행 2')).toBeInTheDocument();
    expect(within(result).getByRole('heading', { name: '저장된 행 2개' })).toBeInTheDocument();
  });

  it('업서트 키를 끄면 같은 sku 가 파일 안과 다시 올린 뒤에도 여러 번 저장돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /업서트 키/ }));
    await user.click(screen.getByRole('button', { name: '올리기' }));

    const result = screen.getByRole('region', { name: '처리 결과' });
    expect(within(result).getByText('저장 3행 · 거절 3행')).toBeInTheDocument();
    expect(within(result).getByText(/같은 sku 가 여러 번 저장됐어요: A-100/)).toBeInTheDocument();
  });
});
