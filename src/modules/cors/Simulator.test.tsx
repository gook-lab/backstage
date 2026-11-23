import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('CORS 시뮬레이터', () => {
  it('기본 설정에서는 OPTIONS 만 서버에 도착하고 실제 요청은 나가지 않아요', () => {
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '판정 결과' });
    expect(screen.getByRole('status')).toHaveTextContent('실제 요청은 나가지 않았어요');
    expect(within(results).getByText('OPTIONS 만')).toBeInTheDocument();
    expect(within(results).getByText('불가')).toBeInTheDocument();
  });

  it('Allow-Origin 과 Allow-Headers 를 주면 프리플라이트가 통과하고 JS 가 응답을 읽어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Allow-Origin *' }));
    await user.click(screen.getByRole('radio', { name: 'Allow-Headers Content-Type, traceparent' }));
    expect(screen.getByRole('status')).toHaveTextContent('JS 가 응답을 읽을 수 있어요');
    expect(screen.getByText('OPTIONS + 실제 요청')).toBeInTheDocument();
  });

  it('자격 증명을 보내면서 Allow-Origin 에 * 를 쓰면 프리플라이트부터 막혀요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Allow-Origin *' }));
    await user.click(screen.getByRole('radio', { name: 'Allow-Headers Content-Type, traceparent' }));
    await user.click(screen.getByRole('radio', { name: '쿠키 포함 (credentials: include)' }));
    expect(screen.getByRole('status')).toHaveTextContent('실제 요청은 나가지 않았어요');
    expect(screen.getByText(/Credential is not supported/)).toBeInTheDocument();
  });

  it('Expose-Headers 에 ETag 를 체크하면 JS 가 읽는 헤더 목록에 들어가요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Allow-Origin *' }));
    await user.click(screen.getByRole('radio', { name: 'Allow-Headers Content-Type, traceparent' }));
    await user.click(screen.getByRole('checkbox', { name: 'ETag' }));
    expect(screen.getByText('Content-Type, ETag')).toBeInTheDocument();
  });
});
