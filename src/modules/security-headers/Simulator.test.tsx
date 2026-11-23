import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const row = (label: string) =>
  screen.getAllByRole('listitem').find((li) => li.querySelector('strong')?.textContent === label) as HTMLElement;

describe('보안 헤더 시뮬레이터', () => {
  it('기본 nonce 정책에서는 nonce 없는 인라인 스크립트와 외부 분석 스크립트가 막혀요', () => {
    render(<Simulator />);
    expect(screen.getByRole('status')).toHaveTextContent('막힌 자원이 5개 있어요');
    expect(within(row('인라인 <script> (nonce · 해시 없음)')).getByText('차단')).toBeInTheDocument();
    expect(within(row('외부 분석 스크립트 cdn.analytics.example')).getByText('차단')).toBeInTheDocument();
    expect(within(row('nonce 붙은 인라인 <script nonce="k3Yq7vN2bX">')).getByText('허용')).toBeInTheDocument();
  });

  it('예전 방식 프리셋을 고르면 인라인과 외부 분석 스크립트가 허용돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: "'unsafe-inline' 허용 (예전 방식)" }));
    expect(within(row('인라인 <script> (nonce · 해시 없음)')).getByText('허용')).toBeInTheDocument();
    expect(within(row('외부 분석 스크립트 cdn.analytics.example')).getByText('허용')).toBeInTheDocument();
  });

  it('Report-Only 를 켜면 막지 않고 보고만 해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('checkbox', { name: /Report-Only/ }));
    expect(screen.getByRole('status')).toHaveTextContent('보고만 된 자원이');
    expect(within(row('외부 분석 스크립트 cdn.analytics.example')).getByText('보고만')).toBeInTheDocument();
  });

  it('HTTP 응답에 실은 HSTS 는 기억되지 않아서 http 요청이 그대로 나가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'max-age=31536000' }));
    await user.click(screen.getByRole('radio', { name: 'HTTP 응답에 실어 보냄' }));
    expect(screen.getByText(/HTTP 로 받은 응답의 HSTS 헤더는 무시해요/)).toBeInTheDocument();
  });
});
