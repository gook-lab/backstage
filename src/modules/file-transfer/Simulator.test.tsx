import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const resultTable = () => screen.getByRole('table', { name: '업로드 비교 결과' });

describe('파일 업로드 시뮬레이터', () => {
  it('기본값 10 GiB 는 단일 업로드가 끝내지 못하고 멀티파트는 완료해요', () => {
    render(<Simulator />);
    const table = resultTable();

    expect(within(table).getByText('끝까지 못 보냈어요')).toBeInTheDocument();
    expect(within(table).getByText('완료')).toBeInTheDocument();
  });

  it('파일이 100 MiB 로 작으면 두 방식 모두 완료해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '100 MiB · 사진 여러 장' }));
    const table = resultTable();

    expect(within(table).queryByText('끝까지 못 보냈어요')).not.toBeInTheDocument();
    expect(within(table).getAllByText('완료')).toHaveLength(2);
  });

  it('끊김 확률을 0 으로 내리면 두 방식 모두 다시 보내는 양이 0 이에요', () => {
    render(<Simulator />);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    const table = resultTable();

    expect(within(table).getAllByText('0 MiB')).toHaveLength(2);
  });
});
