import { fireEvent, render, screen, within } from '@testing-library/react';
import Simulator from './Simulator';

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('웹 푸시 알림 시뮬레이터', () => {
  it('기본값에서 네 구독이 각각 다른 결과를 보여 줘요', () => {
    render(<Simulator />);
    expect(within(rowOf('노트북 브라우저 (정상)')).getByText(/바로 전달/)).toBeInTheDocument();
    expect(within(rowOf('휴대폰 (잠깐 꺼짐, 예시)')).getByText(/대기 후 전달/)).toBeInTheDocument();
    expect(within(rowOf('태블릿 (오래 꺼짐, 예시)')).getByText(/버림/)).toBeInTheDocument();
    expect(within(rowOf('옛 구독 (만료, 예시)')).getByText(/구독 삭제 \(404\)/)).toBeInTheDocument();
  });

  it('TTL을 0으로 내리면 꺼진 기기는 대기하지 않고 버려져요', () => {
    render(<Simulator />);
    fireEvent.change(screen.getByRole('slider', { name: /TTL/ }), { target: { value: '0' } });
    expect(within(rowOf('휴대폰 (잠깐 꺼짐, 예시)')).getByText(/버림 · 틱 10/)).toBeInTheDocument();
    expect(screen.getByText(/TTL 0 이에요/)).toBeInTheDocument();
  });

  it('발송 시각을 기기가 켜진 뒤로 옮기면 TTL과 관계없이 바로 전달돼요', () => {
    render(<Simulator />);
    fireEvent.change(screen.getByRole('slider', { name: /발송 시각/ }), { target: { value: '15' } });
    expect(within(rowOf('휴대폰 (잠깐 꺼짐, 예시)')).getByText(/바로 전달 · 틱 15/)).toBeInTheDocument();
  });
});
