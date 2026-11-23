import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('입력 검증 시뮬레이터', () => {
  it('기본값은 가족 이모지를 화면에서 막고 서버에서는 받는 어긋남을 보여 줘요', () => {
    render(<Simulator />);
    const client = screen.getByRole('region', { name: '판정' }).querySelector('[data-side="client"]') as HTMLElement;
    const server = screen.getByRole('region', { name: '판정' }).querySelector('[data-side="server"]') as HTMLElement;

    expect(within(client).getByText('막음')).toBeInTheDocument();
    expect(within(server).getByText('통과')).toBeInTheDocument();
    expect(screen.getByText('화면은 막지만 서버는 받아요')).toBeInTheDocument();
  });

  it('화면을 서버와 같은 규칙으로 바꾸면 두 판정이 어긋나지 않아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '서버와 같은 규칙' }));
    expect(screen.getByText('둘 다 통과해요')).toBeInTheDocument();
  });

  it('분해된 한글 자모를 고르면 저장될 값이 한 음절로 합쳐져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '한글 자모 분리 (분해형)' }));
    expect(screen.getByText(JSON.stringify('한'))).toBeInTheDocument();
  });

  it('중복 값을 켜면 형식은 통과하고 서버가 409 를 돌려줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '한글 이름' }));
    await user.click(screen.getByRole('checkbox', { name: '이미 쓰는 닉네임이에요 (서버만 알아요)' }));
    expect(screen.getByText('이미 쓰는 값이에요 (409)')).toBeInTheDocument();
  });
});
