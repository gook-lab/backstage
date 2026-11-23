import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('API 키 발급과 관리 시뮬레이터', () => {
  it('처음에는 평문 저장과 URL 쿼리 전달로 DB 유출 시 키 두 개가 샌다고 보여 줘요', () => {
    render(<Simulator />);

    expect(screen.getByText('2개', { selector: '.ak-lab__metric-value' })).toBeInTheDocument();
    expect(screen.getByText('평문 저장이라 DB에 있는 값이 그대로 키예요.')).toBeInTheDocument();
  });

  it('권장 예시를 고르면 DB 유출에도 쓸 수 있는 키가 없다고 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '권장 — 해시 · 헤더 · 한 번만 · 7일 겹침' }));
    expect(screen.getByRole('radio', { name: '해시 저장' })).toBeChecked();
    expect(screen.getByText('해시만 저장해서 DB에 키 원문이 없어요.')).toBeInTheDocument();
  });

  it('겹침을 없앤 채 회전 중 옛 키 사건을 고르면 정상 요청이 실패한다고 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '해시 저장' }));
    await user.click(screen.getByRole('radio', { name: '0일 — 새 키를 내자마자 옛 키 폐기' }));
    await user.click(screen.getByRole('radio', { name: '회전 중 옛 키 유출 — 옛 키가 아직 살아 있음' }));

    expect(screen.getByText('옮기는 3일 중 3일 동안 배치 요청이 실패해요.')).toBeInTheDocument();
    expect(
      screen.getByText('옮기는 3일 동안 실패하는 정상 요청', { selector: '.ak-lab__metric-label' }),
    ).toBeInTheDocument();
  });

  it('해시로 저장하면 다시 보기를 골라도 한 번만 보여 준다는 문장을 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '해시 저장' }));
    await user.click(screen.getByRole('radio', { name: '목록에서 전체 키 다시 보기' }));
    expect(screen.getByText('해시로 저장해서 다시 보여 줄 수 없어요. 발급 때 한 번만 보여 줘요.')).toBeInTheDocument();
  });
});
