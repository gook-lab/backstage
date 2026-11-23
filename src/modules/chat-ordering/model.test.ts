import { describe, expect, it } from 'vitest';
import { type Config, DEFAULT_CONFIG, simulate, type View } from './model';

const run = (over: Partial<Config> = {}) => simulate({ ...DEFAULT_CONFIG, ...over });
const ids = (v: View) => v.rows.map((r) => r.id);
const view = (r: ReturnType<typeof run>, viewer: View['viewer']) => r.views.find((v) => v.viewer === viewer)!;

describe('서버 순번 정렬', () => {
  it('기본 설정이면 모든 기기가 같은 순서와 같은 안 읽은 수를 보여요', () => {
    const r = run();
    expect(ids(view(r, 'phone'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3']);
    expect(ids(view(r, 'laptop'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3']);
    expect(ids(view(r, 'peer'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3']);
    expect(r.orderMismatch).toBe(false);
    expect(view(r, 'phone').unread).toBe(2);
    expect(view(r, 'laptop').unread).toBe(2);
    expect(r.notes).toEqual(['모든 기기가 같은 순서와 같은 안 읽은 수를 보여요.']);
  });

  it('전송 직후 자리와 새로고침 뒤 자리가 같으면 옮겨 가는 메시지가 없어요', () => {
    const r = run();
    expect(r.moved.every((m) => m.provisional === m.final)).toBe(true);
  });
});

describe('보낸 기기 시계 기준 정렬', () => {
  it('나 폰 시계가 30초 빠르면 내 메시지가 상대 메시지보다 뒤로 가요', () => {
    const r = run({ sortBy: 'client', meSkew: 30 });
    expect(ids(view(r, 'phone'))).toEqual(['P1', 'P2', 'P3', 'M1', 'M2']);
    expect(r.notes.join(' ')).toContain('이 정렬 기준은 서버 순번과 달라요');
  });

  it('시계 오차가 없으면 같은 상황에서 전송 직후와 새로고침 뒤 자리가 같아요', () => {
    const r = run({ sortBy: 'client', meDelay: 2000 });
    const m1 = r.moved.find((m) => m.id === 'M1')!;
    expect(m1.provisional).toBe(m1.final);
  });

  it('시계 오차 때문에 전송 직후에 보인 자리와 새로고침 뒤 자리가 달라져요', () => {
    const r = run({ sortBy: 'client', meSkew: 30 });
    const m1 = r.moved.find((m) => m.id === 'M1')!;
    expect(m1).toEqual({ id: 'M1', provisional: 2, final: 4 });
  });
});

describe('서버 수신 시각 (초 단위) 정렬', () => {
  it('같은 초에 도착한 메시지는 서버 순번과 다른 순서로 정렬될 수 있어요', () => {
    const r = run({ sortBy: 'arrival' });
    expect(ids(view(r, 'phone'))).toEqual(['M1', 'P1', 'M2', 'P2', 'P3']);
  });
});

describe('기기가 받은 순서 정렬', () => {
  it('노트북이 재연결 뒤 채운 메시지는 받은 시각이 늦어 기기마다 순서가 달라져요', () => {
    const r = run({ sortBy: 'received', offline: true, fill: true, peerDelay: 1500 });
    expect(ids(view(r, 'laptop'))).toEqual(['M1', 'M2', 'P1', 'P2', 'P3']);
    expect(ids(view(r, 'phone'))).toEqual(['M1', 'P1', 'M2', 'P2', 'P3']);
    expect(r.orderMismatch).toBe(true);
  });
});

describe('연결 끊김과 재연결', () => {
  it('끊긴 동안 도착한 메시지를 채우지 않으면 노트북에 빠진 메시지가 남아요', () => {
    const r = run({ offline: true, fill: false });
    expect(view(r, 'laptop').missing).toEqual(['M2']);
    expect(ids(view(r, 'laptop'))).toEqual(['P1', 'M1', 'P2', 'P3']);
    expect(r.notes.join(' ')).toContain('노트북은 내 2 메시지를 받지 못했어요');
  });

  it('재연결 뒤 마지막 순번 이후를 요청하면 빠진 메시지를 채워요', () => {
    const r = run({ offline: true, fill: true });
    expect(view(r, 'laptop').missing).toEqual([]);
    expect(ids(view(r, 'laptop'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3']);
  });
});

describe('재전송과 중복 저장', () => {
  it('ACK 를 잃고 다시 보낸 메시지를 거르지 않으면 같은 메시지가 두 번 저장돼요', () => {
    const r = run({ retry: true, dedupe: false });
    expect(r.duplicates).toBe(1);
    expect(ids(view(r, 'phone'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3', 'M2']);
    expect(r.notes.join(' ')).toContain('같은 메시지가 서버에 1번 더 저장됐어요');
  });

  it('클라이언트 메시지 id 로 거르면 재전송은 처음 순번을 돌려받아요', () => {
    const r = run({ retry: true, dedupe: true });
    expect(r.duplicates).toBe(0);
    expect(ids(view(r, 'phone'))).toEqual(['P1', 'M1', 'P2', 'M2', 'P3']);
  });
});

describe('읽음 위치와 안 읽은 수', () => {
  it('읽음 위치를 기기 안에만 두면 나 폰은 상대 메시지를 전부 안 읽은 것으로 세요', () => {
    const r = run({ readSync: 'local' });
    expect(view(r, 'phone').unread).toBe(3);
    expect(view(r, 'laptop').unread).toBe(2);
    expect(r.notes.join(' ')).toContain('나 폰의 안 읽은 수(3개)와 노트북(2개)이 달라요');
  });

  it('노트북이 빠뜨린 메시지는 안 읽은 수에 세지 못해요', () => {
    const r = run({ offline: true, fill: false });
    expect(view(r, 'laptop').unread).toBe(2);
    expect(view(r, 'phone').unread).toBe(2);
  });
});

describe('낙관적 전송 위치', () => {
  it('내 메시지가 늦게 도착하면 전송 직후 자리와 새로고침 뒤 자리가 달라요', () => {
    const r = run({ meDelay: 2000 });
    expect(r.moved.find((m) => m.id === 'M1')).toEqual({ id: 'M1', provisional: 2, final: 3 });
    expect(r.notes.join(' ')).toContain('내 1 메시지는 전송 직후 2번째에 보였다가 새로고침 뒤 3번째로 옮겨 가요');
  });
});
