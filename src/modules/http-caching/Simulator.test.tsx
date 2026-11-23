import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const card = (layer: 'browser' | 'shared') => {
  const results = screen.getByRole('region', { name: '결과' });
  return within(results)
    .getByText(layer === 'browser' ? '개인 캐시 (브라우저)' : '공유 캐시 (CDN · 프록시)')
    .closest('article')!;
};

describe('HTTP 캐시 시뮬레이터', () => {
  it('결제 상세(no-store)는 두 층 모두 원 서버 요청으로 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '결제 상세' }));
    expect(within(card('browser')).getByText('원 서버 요청 · 저장본 안 씀')).toBeInTheDocument();
    expect(within(card('shared')).getByText('원 서버 요청 · 저장본 안 씀')).toBeInTheDocument();
    expect(within(card('shared')).getByText(/no-store 라서/)).toBeInTheDocument();
  });

  it('CDN 예시에서 30초가 지나면 공유 캐시는 신선 사용하고 개인 캐시는 304 로 재검증해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'CDN 에만 길게' }));
    await user.click(screen.getByRole('radio', { name: '30초 전' }));
    expect(within(card('shared')).getByText('신선 사용 · 네트워크 요청 없음')).toBeInTheDocument();
    expect(within(card('browser')).getByText('재검증 304 · 저장본 재사용')).toBeInTheDocument();
  });
});
