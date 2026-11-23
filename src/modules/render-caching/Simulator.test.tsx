import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const metric = (label: string) => screen.getByText(label).closest('.rc-metric') as HTMLElement;

describe('서버 렌더링 캐시 시뮬레이터', () => {
  it('기본값은 섞인 페이지를 재검증 1분으로 돌린 결과를 보여 주고, 예시 문구를 붙여요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    expect(within(result).getByText(/캐시가 답한 요청은/)).toBeInTheDocument();
    expect(within(result).getByText(/수치는 감을 잡기 위한 예시예요/)).toBeInTheDocument();
    expect(within(metric('원 서버 상품 페이지 렌더링')).getByText(/회$/)).toBeInTheDocument();
    expect(screen.queryByText('개인 부분 원 서버 호출')).not.toBeInTheDocument();
  });

  it('요청마다 렌더링을 고르면 캐시 적중률이 0%가 되고 재검증 간격 선택지는 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '요청마다 렌더링' }));
    expect(within(metric('캐시 적중률')).getByText('0%')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '10분' })).not.toBeInTheDocument();
  });

  it('공용 HTML + 개인 부분 따로를 고르면 개인 부분 원 서버 호출 항목이 나타나요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '공용 HTML + 개인 부분 따로' }));
    expect(screen.getByText('개인 부분 원 서버 호출')).toBeInTheDocument();
  });

  it('공용만 두고 빌드 때만 렌더링하면, 가격을 오후 1시에 바꾼 뒤 다음 배포까지 옛 가격이 나가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '공용만' }));
    await user.click(screen.getByRole('radio', { name: '빌드 때만 렌더링 (예시: 6시간마다 배포)' }));
    expect(within(metric('원 서버 상품 페이지 렌더링')).getByText('4회')).toBeInTheDocument();
    expect(within(metric('옛 가격이 나간 최대 시간')).getByText('5시간')).toBeInTheDocument();
  });
});
