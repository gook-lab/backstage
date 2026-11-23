import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const result = () => screen.getByRole('region', { name: '결과' });
const stat = (label: string) => within(result()).getByText(label).nextElementSibling;

describe('웹훅 발송 시뮬레이터', () => {
  it('기본값은 정상 응답과 큐 발송이고, 이벤트 12건이 모두 성공해요', () => {
    render(<Simulator />);

    expect(stat('성공')).toHaveTextContent('12건');
    expect(stat('포기 · 실패')).toHaveTextContent('0건');
    expect(within(result()).getByText(/모든 이벤트가 제때 전달됐고/)).toBeInTheDocument();
  });

  it('느린 엔드포인트에서 격리를 끄면 고객 B 의 발송이 밀리고, 켜면 제때 나가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '느림 · 응답에 5틱 걸려요' }));
    await user.click(screen.getByRole('radio', { name: '큐 + 백오프' }));
    expect(within(result()).getByText(/고객 B 의 발송이 \d+틱 늦었어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '큐 + 백오프 + 엔드포인트별 격리' }));
    expect(stat('고객 B 가장 늦은 전달')).toHaveTextContent('1틱');
  });

  it('자동 비활성화를 고르면 멈춘 엔드포인트의 이벤트가 보류로 남아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '500 반복' }));
    await user.click(screen.getByRole('radio', { name: '자동 비활성화 · 격리 + 연속 실패 3번이면 멈춤' }));
    expect(stat('보류')).not.toHaveTextContent('0건');
    expect(within(result()).getByText(/보류한 이벤트를 고객에게 알렸어요/)).toBeInTheDocument();
  });

  it('틱 슬라이더를 0으로 옮기면 아직 시작하지 않은 시도는 보이지 않아요', () => {
    render(<Simulator />);
    fireEvent.change(screen.getByRole('slider', { name: /틱 보기/ }), { target: { value: '0' } });

    expect(screen.getByText(/^0 \/ \d+ 틱 보기/)).toBeInTheDocument();
    expect(screen.queryByText('틱 1')).not.toBeInTheDocument();
  });
});
