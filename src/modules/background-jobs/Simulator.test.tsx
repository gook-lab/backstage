import { fireEvent, render, screen, within } from '@testing-library/react';
import Simulator from './Simulator';

const slider = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const card = (name: RegExp) => screen.getByRole('region', { name });

describe('비동기 작업 시뮬레이터', () => {
  it('기본값은 작업 45초, 게이트웨이 30초라서 동기 처리는 504로 끝나요', () => {
    render(<Simulator />);
    const sync = card(/^동기 처리 결과/);

    expect(within(sync).getByText(/504를 받았어요/)).toBeInTheDocument();
    expect(within(sync).getByText(/다시 누르면 같은 작업이 한 번 더 돌 수 있어요/)).toBeInTheDocument();
  });

  it('202 접수 방식은 같은 작업을 504 없이 조회 끝에 받아요', () => {
    render(<Simulator />);
    const poll = card(/^202 접수 \+ 폴링 결과/);

    expect(within(poll).getByText(/접수 응답은 바로 받았어요/)).toBeInTheDocument();
    expect(within(poll).getByText(/조회 9번 끝에 45초에 결과를 봤어요/)).toBeInTheDocument();
    expect(within(poll).queryByText('504')).not.toBeInTheDocument();
  });

  it('게이트웨이 제한을 작업보다 길게 올리면 동기 처리도 결과를 받아요', () => {
    render(<Simulator />);
    fireEvent.change(slider(/게이트웨이 제한 시간/), { target: { value: '60' } });

    expect(within(card(/^동기 처리 결과/)).getByText(/요청 하나로 45초에 결과를 받았어요/)).toBeInTheDocument();
    expect(within(card(/^동기 처리 결과/)).queryByText(/다시 누르면/)).not.toBeInTheDocument();
  });

  it('폴링 간격을 키우면 조회 수가 줄고 결과는 늦게 보여요', () => {
    render(<Simulator />);
    fireEvent.change(slider(/폴링 간격/), { target: { value: '15' } });

    const poll = card(/^202 접수 \+ 폴링 결과/);
    expect(within(poll).getByText(/조회 3번 끝에 45초에 결과를 봤어요/)).toBeInTheDocument();
  });
});
