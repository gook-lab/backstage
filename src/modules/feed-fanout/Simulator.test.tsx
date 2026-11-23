import { fireEvent, render, screen, within } from '@testing-library/react';
import Simulator from './Simulator';
import { DEFAULTS, makeGraph, normalAuthor } from './model';

describe('피드 fan-out 시뮬레이터', () => {
  it('유명 사용자 기준을 낮추면 하이브리드도 일반 사용자 글을 받은편지함에 밀어 넣지 않아요', () => {
    render(<Simulator />);
    const graph = makeGraph(DEFAULTS.users, DEFAULTS.seed);
    const normal = normalAuthor(graph);
    const hybridCells = () =>
      within(screen.getByRole('rowheader', { name: /하이브리드/ }).closest('tr') as HTMLElement).getAllByRole('cell');

    expect(hybridCells()[0].textContent).toBe(String(graph.followers[normal].length));

    fireEvent.change(screen.getByLabelText(/유명 사용자 기준/), { target: { value: '5' } });

    expect(hybridCells()[0].textContent).toBe('0');
    expect(screen.getByText(/팔로워 5명 이상/)).toBeInTheDocument();
  });
});
