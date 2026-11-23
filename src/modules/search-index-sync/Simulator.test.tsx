import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const stat = (label: string) => screen.getByText(label).nextElementSibling;

describe('검색 색인 반영 시뮬레이터', () => {
  it('기본 아웃박스 시나리오는 2초 뒤부터 검색 결과가 DB 와 같아요', () => {
    render(<Simulator />);
    expect(stat('같아지는 시각')).toHaveTextContent('2초');
    expect(screen.getByText('2초 뒤부터 검색 결과가 DB 와 같아요.')).toBeInTheDocument();
  });

  it('이중 쓰기에서 색인 쓰기가 실패하고 재시도를 끄면 영구 불일치라고 알려 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '이중 쓰기 · 색인 쓰기 1번 실패 · 재시도 없음' }));
    expect(stat('같아지는 시각')).toHaveTextContent('같아지지 않아요');
    expect(screen.getByText(/영구 불일치예요/)).toBeInTheDocument();
    expect(stat('120초 뒤 검색 결과')).toHaveTextContent('옛 이름');
  });

  it('재시도를 켜면 5초 뒤 색인 쓰기가 성공해 검색 결과가 맞아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '이중 쓰기 · 색인 쓰기 1번 실패 · 재시도 있음' }));
    expect(stat('같아지는 시각')).toHaveTextContent('5초');
    expect(screen.getByText('5초: 색인 쓰기 2번째 성공.')).toBeInTheDocument();
  });

  it('전체 재색인을 켜면 실패로 남은 옛 값이 재색인 뒤에 정리돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '이중 쓰기 실패 뒤 전체 재색인 (60초에 시작)' }));
    const result = screen.getByRole('region', { name: '결과' });
    expect(within(result).getByText('90초 뒤부터 검색 결과가 DB 와 같아요.')).toBeInTheDocument();
  });
});
