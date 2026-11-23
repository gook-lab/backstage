import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const statValue = (result: HTMLElement, label: string) =>
  within(result).getByText(label).nextElementSibling?.textContent ?? '';

describe('기능 플래그 시뮬레이터', () => {
  it('기본값인 서버 평가에서는 화면과 서버가 어긋난 요청이 없다고 보여 줘요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    expect(within(result).getByText('화면과 서버가 어긋난 요청이 없어요')).toBeInTheDocument();
    expect(statValue(result, '화면과 서버가 다른 값을 본 요청')).toMatch(/^0회 \/ 4,000회$/);
  });

  it('둘 다 각자 평가에서 서버 캐시 지연을 주면 어긋난 요청이 생겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '둘 다 각자' }));
    fireEvent.change(screen.getByLabelText(/플래그 캐시 지연/), { target: { value: '2' } });

    expect(within(result).getByText('화면과 서버가 서로 다른 값을 본 요청이 있어요')).toBeInTheDocument();
    expect(statValue(result, '화면과 서버가 다른 값을 본 요청')).not.toMatch(/^0회/);
  });

  it('클라이언트 평가에서는 서버가 화면 값을 따르고, 돈이 걸린 분기를 맡기는 대가를 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '클라이언트 평가' }));
    fireEvent.change(screen.getByLabelText(/플래그 캐시 지연/), { target: { value: '2' } });

    expect(within(result).getByText('화면과 서버가 어긋난 요청이 없어요')).toBeInTheDocument();
    expect(within(result).getByText(/돈이 걸린 분기를 클라이언트 값에 맡기게 돼요/)).toBeInTheDocument();
  });

  it('무작위 배정은 해시 배정과 달리 결과가 바뀌는 사용자 수를 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const flip = screen.getByRole('table');

    expect(within(flip).getByRole('row', { name: /사용자 id 해시/ })).toHaveTextContent('0명');

    fireEvent.change(screen.getByLabelText(/출시 비율/), { target: { value: '50' } });
    await user.click(screen.getByRole('radio', { name: '매번 무작위' }));
    const result = screen.getByRole('region', { name: '결과' });
    expect(within(result).getByText(/무작위 배정은 같은 사용자도 방문마다 다른 결과를 받아요/)).toBeInTheDocument();
  });
});
