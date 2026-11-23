import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const flag = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });

/** 통계 칸은 라벨 글자가 든 칸 전체로 확인해요 */
const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('배치 작업 시뮬레이터', () => {
  it('기본값은 중간에 죽었다가 체크포인트부터 이어서 중복 없이 끝나요', () => {
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '정산 결과' });

    expect(within(results).getByText('중복 정산 건수')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/틱 \d+에 워커가 죽었어요\. 건 500부터 다시 시작했어요\./)).toBeInTheDocument();
  });

  it('멱등 처리를 끄면 커밋 전 부분이 중복 정산되고 경고가 떠요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    // 기본값은 켜짐이라, 한 번 누르면 꺼져요
    await user.click(flag('멱등 처리를 켜요'));
    expect(flag('멱등 처리를 켜요')).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('같은 정산 건 50건이 두 번 나갔어요');
    expect(stat('중복 정산 건수')).toHaveTextContent('50건');
  });

  it('동시 실행을 잠그지 않으면 두 번째 실행이 같은 건을 다시 정산해요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    // 멱등 끔, 잠금 끔, 두 번째 실행 켬
    await user.click(flag('멱등 처리를 켜요'));
    await user.click(flag('같은 배치가 두 번 돌지 않게 잠가요'));
    await user.click(flag('두 번째 실행을 같은 시각에 시작해요'));
    expect(stat('중복 정산 건수')).not.toHaveTextContent(/^0건/);
    expect(stat('거절된 두 번째 실행')).toHaveTextContent('0회');
  });

  it('다른 시드로 돌리면 시드 번호가 바뀌고 처리 시간이 함께 바뀔 수 있어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    expect(screen.getByText(/시드 7 ·/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 시드로 다시 돌리기' }));
    expect(screen.getByText(/시드 8 ·/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '정산 진행률' })).toBeInTheDocument();
  });
});
