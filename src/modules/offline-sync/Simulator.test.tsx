import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('오프라인 동기화 시뮬레이터', () => {
  it('기본 설정은 마지막 쓰기 우선이라 잃은 변경을 알리고, 응답은 모두 200이에요', () => {
    render(<Simulator />);
    expect(screen.getByRole('status')).toHaveTextContent('기기 한 대의 편집이 사라졌어요');
    expect(screen.getByRole('table', { name: '대기열 전송 순서와 서버 응답' })).not.toHaveTextContent('409');
  });

  it('폰이 먼저 도착하고 문서 전체를 보내면 필드 병합으로 바꿨을 때 잃는 값이 줄어요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const results = screen.getByRole('region', { name: '결과' });

    await user.click(screen.getByRole('radio', { name: '폰 대기열이 먼저 도착' }));
    await user.click(screen.getByRole('radio', { name: '문서 전체 보내기' }));
    await user.click(screen.getByRole('radio', { name: '마지막 쓰기 우선' }));
    expect(within(results).getByText('최종 제목')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('폰의 제목 "주말 장보기"');

    await user.click(screen.getByRole('radio', { name: '필드 단위 병합' }));
    expect(screen.getByRole('status')).not.toHaveTextContent('폰의 제목');
    expect(screen.getByRole('status')).toHaveTextContent('폰의 본문 "우유, 계란"');
  });

  it('사용자 선택으로 바꾸면 노트북 본문 충돌이 409로 보류되고 잃은 변경 알림은 사라져요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '폰 대기열이 먼저 도착' }));
    await user.click(screen.getByRole('radio', { name: '사용자 선택 (보류)' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: '대기열 전송 순서와 서버 응답' })).toHaveTextContent('409');
    expect(screen.getByRole('table', { name: '기기별 화면에 남은 값' })).toHaveTextContent('우유, 계란');
  });
});
