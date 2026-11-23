import { describe, expect, it } from 'vitest';
import { ARRIVALS, BASE, changeStatus, COMBOS, isConverged, runScene } from './model';

describe('같은 자리 삽입 장면', () => {
  it('위치 그대로 적용하면 두 화면이 서로 다른 문자열로 끝나요', () => {
    const s = runScene('raw', 'same-insert', 'a-first');
    expect(s.a).toBe('정리: 오늘 회의록');
    expect(s.b).toBe('오늘 정리: 회의록');
    expect(isConverged(s)).toBe(false);
  });

  it('전체 덮어쓰기는 나중 저장만 남겨 앞 사람의 글이 사라져요', () => {
    const s = runScene('overwrite', 'same-insert', 'a-first');
    expect(s.server).toBe('정리: 회의록');
    expect(changeStatus(s.server, 'A', 'same-insert')).toBe('사라짐');
    expect(changeStatus(s.server, 'B', 'same-insert')).toBe('남음');
  });

  it('위치 변환과 글자 id는 두 화면을 같은 문자열로 모아요', () => {
    for (const method of ['ot', 'crdt'] as const) {
      for (const arrival of ARRIVALS) {
        const s = runScene(method, 'same-insert', arrival);
        expect(isConverged(s)).toBe(true);
        expect(s.server).toContain('오늘 ');
        expect(s.server).toContain('정리: ');
        expect(s.server.endsWith('회의록')).toBe(true);
      }
    }
  });

  it('위치 변환은 서버가 먼저 받은 글을 앞에 두고, 글자 id는 도착 순서와 상관없이 정해요', () => {
    expect(runScene('ot', 'same-insert', 'a-first').server).toBe('오늘 정리: 회의록');
    expect(runScene('ot', 'same-insert', 'b-first').server).toBe('정리: 오늘 회의록');
    expect(runScene('crdt', 'same-insert', 'a-first').server).toBe('정리: 오늘 회의록');
    expect(runScene('crdt', 'same-insert', 'b-first').server).toBe('정리: 오늘 회의록');
  });
});

describe('한쪽 삭제 · 다른 쪽 삽입 장면', () => {
  it('위치 그대로 적용하면 한 화면에서 엉뚱한 글자가 지워져요', () => {
    const s = runScene('raw', 'insert-delete', 'a-first');
    expect(s.server).toBe('정리: 회록');
    expect(s.b).toBe('정: 회의록');
    expect(changeStatus(s.b, 'A', 'insert-delete')).toBe('안 지워짐');
    expect(changeStatus(s.b, 'B', 'insert-delete')).toBe('깨짐');
  });

  it('위치 변환과 글자 id는 모든 도착 순서에서 "의"만 지워요', () => {
    for (const method of ['ot', 'crdt'] as const) {
      for (const arrival of ARRIVALS) {
        const s = runScene(method, 'insert-delete', arrival);
        expect(s.server).toBe('정리: 회록');
        expect(isConverged(s)).toBe(true);
      }
    }
  });
});

describe('같은 글자 동시 삭제 장면', () => {
  it('위치 그대로 적용하면 두 번째 삭제가 옆 글자 "록"을 지워요', () => {
    const s = runScene('raw', 'same-delete', 'a-first');
    expect(s.server).toBe('회');
    expect(changeStatus(s.server, 'A', 'same-delete')).toBe('엉뚱한 글자 지워짐');
  });

  it('위치 변환과 글자 id는 같은 글자를 한 번만 지워요', () => {
    for (const method of ['ot', 'crdt'] as const) {
      for (const arrival of ARRIVALS) {
        const s = runScene(method, 'same-delete', arrival);
        expect(s.server).toBe('회록');
        expect(isConverged(s)).toBe(true);
      }
    }
  });
});

describe('수렴과 사용자 변경 보존', () => {
  it('위치 변환과 글자 id는 모든 장면과 도착 순서에서 두 화면이 같아요', () => {
    for (const method of ['ot', 'crdt'] as const) {
      for (const combo of COMBOS) {
        for (const arrival of ARRIVALS) {
          expect(isConverged(runScene(method, combo, arrival))).toBe(true);
        }
      }
    }
  });

  it('글자 id 방식은 도착 순서를 바꿔도 최종 문자열이 같아요', () => {
    for (const combo of COMBOS) {
      const ab = runScene('crdt', combo, 'a-first');
      const ba = runScene('crdt', combo, 'b-first');
      expect(ab.server).toBe(ba.server);
    }
  });

  it('위치 변환과 글자 id는 어떤 장면에서도 사용자 변경을 잃지 않아요', () => {
    for (const method of ['ot', 'crdt'] as const) {
      for (const combo of COMBOS) {
        for (const arrival of ARRIVALS) {
          const s = runScene(method, combo, arrival);
          for (const who of ['A', 'B'] as const) {
            const status = changeStatus(s.server, who, combo);
            expect(['남음', '반영']).toContain(status);
          }
        }
      }
    }
  });

  it('기준 문서는 회의록이에요', () => {
    expect(BASE).toBe('회의록');
  });
});
