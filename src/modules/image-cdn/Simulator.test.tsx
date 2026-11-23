import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

describe('이미지와 CDN 시뮬레이터', () => {
  it('기본값은 휴대폰 DPR 3 에 맞는 1280w AVIF 를 고르고, 캐시 키 네 가지를 비교해 보여 줘요', () => {
    render(<Simulator />);
    const choice = screen.getByRole('region', { name: '브라우저 선택' });
    expect(within(choice).getByText('1280w')).toBeInTheDocument();
    expect(within(choice).getByText('AVIF')).toBeInTheDocument();

    const cache = screen.getByRole('region', { name: '캐시 키' });
    const rows = within(cache).getAllByRole('row');
    // 헤더 한 줄 + 캐시 키 네 줄
    expect(rows).toHaveLength(5);
  });

  it('고정 320px 슬롯으로 바꾸면 같은 기기가 960w 를 받아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '고정 320px' }));

    const choice = screen.getByRole('region', { name: '브라우저 선택' });
    expect(within(choice).getByText('960w')).toBeInTheDocument();
  });

  it('AVIF 를 끄면 AVIF 를 읽는 기기도 WebP 를 받아요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('checkbox', { name: /^AVIF/ }));

    const choice = screen.getByRole('region', { name: '브라우저 선택' });
    expect(within(choice).getByText('WEBP')).toBeInTheDocument();
    expect(within(choice).queryByText('AVIF')).not.toBeInTheDocument();
  });

  it('캐시 키를 경로만으로 바꾸면 설명이 바뀌고, 해시를 끄면 무효화 대상이 생겨요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await user.click(screen.getByRole('radio', { name: '경로만' }));
    const cache = screen.getByRole('region', { name: '캐시 키' });
    expect(within(cache).getByText('쿼리를 무시해요. 모든 크기가 한 키로 묶여요.')).toBeInTheDocument();

    const purge = screen.getByRole('region', { name: '무효화' });
    expect(within(purge).getByText('이미지 한 장을 바꿀 때 무효화할 URL 0개')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /^파일 이름에 내용 해시/ }));
    expect(within(purge).getByText('이미지 한 장을 바꿀 때 무효화할 URL 192개')).toBeInTheDocument();
  });
});
