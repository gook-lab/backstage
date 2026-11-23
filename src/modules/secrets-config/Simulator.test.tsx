import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('환경 설정과 비밀 값 시뮬레이터', () => {
  it('처음에는 비밀 값이 번들에 들어가는 잘못된 예를 보여 줘요', () => {
    render(<Simulator />);

    expect(screen.getByText('비밀 값 3개가 배포 번들에 들어가요.')).toBeInTheDocument();
    expect(screen.getByText(/VITE_PAYMENT_SECRET_KEY = "/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '노출됐다면 할 일' })).toBeInTheDocument();
  });

  it('권장 예시를 고르면 노출이 없고 할 일 목록도 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '권장 — 공개 값만 빌드에, 비밀은 서버 뒤에' }));
    expect(screen.getByText('배포 번들에 비밀 값이 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '노출됐다면 할 일' })).not.toBeInTheDocument();
  });

  it('공개 키에서 접두를 빼면 브라우저에서 읽을 수 없다고 판정해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('checkbox', { name: /^공개 키 접두 붙이기/ }));
    expect(screen.getByText('브라우저 코드에서 읽을 수 없어요')).toBeInTheDocument();
    expect(screen.queryByText(/VITE_MAP_KEY = "/)).not.toBeInTheDocument();
  });

  it('결제 비밀 키를 서버 실행 환경으로 옮기면 노출 수가 두 개로 줄어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    const serverRadios = screen.getAllByRole('radio', { name: '서버 실행 환경' });
    await user.click(serverRadios[2]);
    expect(screen.getByText('비밀 값 2개가 배포 번들에 들어가요.')).toBeInTheDocument();
    expect(screen.getByText('접두 때문에 공개 값처럼 보여요', { exact: false })).toBeInTheDocument();
  });

  it('빌드 도구를 Next.js 로 바꾸면 NEXT_PUBLIC_ 접두 이름으로 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: 'Next.js (NEXT_PUBLIC_)' }));
    expect(screen.getByText('NEXT_PUBLIC_PAYMENT_SECRET_KEY')).toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_DB_PASSWORD = "/)).toBeInTheDocument();
  });
});
