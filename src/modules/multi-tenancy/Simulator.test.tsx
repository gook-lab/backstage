import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('멀티테넌시 시뮬레이터', () => {
  it('기본값은 사고가 없어서 다른 회사 데이터가 보이지 않아요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    expect(within(result).getByText('다른 회사 데이터는 보이지 않아요')).toBeInTheDocument();
    expect(within(result).getByText('영향 범위 — 영향 없음')).toBeInTheDocument();
  });

  it('테이블 공유에서 조건 빠진 쿼리를 고르면 다른 회사 데이터가 보이고 모든 회사에 영향이 가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '조건 빠진 쿼리' }));
    expect(within(result).getByText('다른 회사 데이터가 보여요')).toBeInTheDocument();
    expect(within(result).getByText('영향 범위 — 모든 회사에 영향')).toBeInTheDocument();
  });

  it('같은 사고라도 조회 계층이 강제하면 다른 회사 데이터가 보이지 않아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '조건 빠진 쿼리' }));
    await user.click(screen.getByRole('radio', { name: '조회 계층이 강제' }));
    expect(within(result).getByText('다른 회사 데이터는 보이지 않아요')).toBeInTheDocument();
  });

  it('위조된 tenant id는 조건을 직접 쓰면 새고, DB 행 보안으로 바꾸면 막혀요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '위조된 tenant id' }));
    expect(within(result).getByText('다른 회사 데이터가 보여요')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'DB 행 보안 (RLS)' }));
    expect(within(result).getByText('다른 회사 데이터는 보이지 않아요')).toBeInTheDocument();
  });

  it('캐시 키에서 회사 식별자를 빼면 캐시 응답 재사용에서 다른 회사 데이터가 보여요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '캐시 응답 재사용' }));
    expect(within(result).getByText('다른 회사 데이터는 보이지 않아요')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /^캐시 키에 회사 식별자를 넣었나요\?/ }));
    expect(within(result).getByText('다른 회사 데이터가 보여요')).toBeInTheDocument();
  });

  it('큰 회사 몰림에서 테넌트별 한도를 켜면 영향이 한 회사로 줄어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '큰 회사에 요청 몰림' }));
    expect(within(result).getByText('영향 범위 — 모든 회사에 영향')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /^테넌트별 한도를 걸었나요\?/ }));
    expect(within(result).getByText('영향 범위 — 한 회사에만 영향')).toBeInTheDocument();
  });
});
