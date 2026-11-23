import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Simulator from './Simulator';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const checkbox = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(label)}`) });

describe('업로드 검사 시뮬레이터', () => {
  it('기본값은 확장자 · Content-Type 만 보고, 확장자만 png 인 HTML 을 통과시켜요', () => {
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '검사 결과' });

    expect(within(result).getByText('통과했어요')).toBeInTheDocument();
    expect(within(result).getByText(/앱 도메인에서 스크립트가 실행될 수 있어요/)).toBeInTheDocument();
    expect(within(result).getByText(/nosniff 가 없어 브라우저가/)).toBeInTheDocument();
  });

  it('첫 바이트 검사를 켜면 같은 파일이 매직 넘버 단계에서 거절돼요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '검사 결과' });

    await user.click(checkbox('첫 바이트 (매직 넘버)'));
    expect(within(result).getByText('첫 바이트 (매직 넘버) 단계에서 거절했어요')).toBeInTheDocument();
    expect(within(result).getByText('거절된 파일은 저장되지 않아요.')).toBeInTheDocument();
  });

  it('50000×50000 이미지는 크기 검사에서 거절되고, 검사를 끄면 디코딩 메모리 위험을 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '검사 결과' });

    await user.click(screen.getByRole('radio', { name: '작은 파일 · 50000×50000 이미지' }));
    await user.click(screen.getByRole('radio', { name: '형식 · 크기까지' }));
    expect(within(result).getByText('크기 · 해상도 한도 단계에서 거절했어요')).toBeInTheDocument();

    await user.click(checkbox('크기 · 해상도 한도'));
    expect(within(result).getByText('통과했어요')).toBeInTheDocument();
    expect(within(result).getByText(/약 10.0GB/)).toBeInTheDocument();
  });

  it('권장 조합을 고르면 위치 정보가 있는 JPEG 의 위치 위험이 사라지고 예시 문구를 보여 줘요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const result = screen.getByRole('region', { name: '검사 결과' });

    await user.click(screen.getByRole('radio', { name: '위치 EXIF 가 있는 JPEG' }));
    expect(within(result).getByText(/촬영 위치\(EXIF GPS\)가 파일에 그대로 남아 있어요/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '권장 조합' }));
    expect(within(result).queryByText(/촬영 위치\(EXIF GPS\)/)).not.toBeInTheDocument();
    expect(screen.getByText('수치는 감을 잡기 위한 예시예요.')).toBeInTheDocument();
  });

  it('체크를 바꾸면 검사 조합 예시 선택은 풀려요', async () => {
    const user = userEvent.setup();
    render(<Simulator />);

    await user.click(screen.getByRole('radio', { name: '권장 조합' }));
    expect(screen.getByRole('radio', { name: '권장 조합' })).toBeChecked();

    await user.click(checkbox('재인코딩'));
    expect(screen.getByRole('radio', { name: '권장 조합' })).not.toBeChecked();
  });
});
