import { describe, expect, it } from 'vitest';
import {
  EDGE_RTT,
  SERVER_MS,
  buildTimeline,
  clampDepth,
  compareRows,
  roundCost,
  setupRtts,
  type Config,
} from './model';

const base: Config = {
  rtt: 250,
  protocol: 'h2-tls13',
  state: 'new',
  edge: false,
  edgeHit: true,
  count: 3,
  depth: 2,
  parallel: true,
};

describe('연결 설정 왕복 수', () => {
  it('프로토콜과 연결 상태에 따라 첫 요청 전 왕복 수가 달라요', () => {
    expect(setupRtts('h1-tls12', 'new')).toBe(3);
    expect(setupRtts('h1-tls12', 'resumed')).toBe(2);
    expect(setupRtts('h2-tls13', 'new')).toBe(2);
    expect(setupRtts('h2-tls13', 'resumed')).toBe(1);
    expect(setupRtts('h3', 'new')).toBe(1);
    expect(setupRtts('h3', 'resumed')).toBe(0);
  });

  it('이미 열린 연결은 프로토콜과 관계없이 설정 왕복이 0이에요', () => {
    for (const p of ['h1-tls12', 'h2-tls13', 'h3'] as const) {
      expect(setupRtts(p, 'reused')).toBe(0);
    }
  });
});

describe('단계별 시간 쌓기', () => {
  it('기본 설정은 연결 설정 2왕복과 병렬 요청 2단계로 1,060ms 가 걸려요', () => {
    const t = buildTimeline(base);
    expect(t.total).toBe(2 * 250 + 2 * (250 + SERVER_MS));
    expect(t.total).toBe(1060);
    expect(t.roundTrips).toBe(4);
    expect(t.steps.map((s) => s.label)).toEqual([
      '연결 설정 2왕복',
      '요청 1단계 (왕복 + 서버)',
      '요청 2단계 (왕복 + 서버)',
    ]);
  });

  it('직렬로 보내면 요청 수만큼 왕복이 더해져요', () => {
    const t = buildTimeline({ ...base, parallel: false });
    expect(t.rounds).toBe(3);
    expect(t.total).toBe(2 * 250 + 3 * (250 + SERVER_MS));
  });

  it('의존 단계 수가 요청 수보다 크면 요청 수로 맞춰요', () => {
    expect(clampDepth(3, 9)).toBe(3);
    expect(clampDepth(3, 0)).toBe(1);
    expect(buildTimeline({ ...base, depth: 9 }).rounds).toBe(3);
  });

  it('마지막 단계의 누적 시간이 전체 시간과 같아요', () => {
    for (const parallel of [true, false]) {
      for (const protocol of ['h1-tls12', 'h2-tls13', 'h3'] as const) {
        const t = buildTimeline({ ...base, protocol, parallel, state: 'new' });
        expect(t.steps[t.steps.length - 1].cumulative).toBe(t.total);
      }
    }
  });

  it('0-RTT 로 재개한 QUIC 은 설정 단계 없이 요청 왕복만 남아요', () => {
    const t = buildTimeline({ ...base, protocol: 'h3', state: 'resumed', count: 1, depth: 1 });
    expect(t.steps).toHaveLength(1);
    expect(t.total).toBe(250 + SERVER_MS);
    expect(t.roundTrips).toBe(1);
  });

  it('새 연결 HTTP/1.1 + TLS 1.2 는 같은 요청이라도 가장 느려요', () => {
    const h1 = buildTimeline({ ...base, protocol: 'h1-tls12', count: 1, depth: 1 });
    const h3 = buildTimeline({ ...base, protocol: 'h3', count: 1, depth: 1 });
    expect(h1.total).toBe(3 * 250 + 250 + SERVER_MS);
    expect(h3.total).toBe(250 + 250 + SERVER_MS);
    expect(h1.total).toBeGreaterThan(h3.total);
  });
});

describe('CDN 엣지 적중과 미스', () => {
  it('엣지 적중이면 요청 왕복이 가까운 엣지까지만 걸려요', () => {
    expect(roundCost({ rtt: 250, edge: true, edgeHit: true })).toBe(EDGE_RTT);
    const t = buildTimeline({ ...base, edge: true, edgeHit: true });
    expect(t.total).toBe(2 * EDGE_RTT + 2 * (EDGE_RTT + SERVER_MS));
  });

  it('엣지 미스면 엣지가 오리진까지 한 번 더 다녀와요', () => {
    expect(roundCost({ rtt: 250, edge: true, edgeHit: false })).toBe(EDGE_RTT + 250);
    const t = buildTimeline({ ...base, edge: true, edgeHit: false });
    expect(t.total).toBe(2 * EDGE_RTT + 2 * (EDGE_RTT + 250 + SERVER_MS));
  });

  it('엣지를 쓰지 않으면 적중 여부는 결과에 영향을 주지 않아요', () => {
    expect(buildTimeline({ ...base, edge: false, edgeHit: false }).total).toBe(buildTimeline(base).total);
  });
});

describe('프로토콜 비교 표', () => {
  it('프로토콜 세 가지 곱하기 연결 상태 세 가지로 아홉 줄을 만들어요', () => {
    const rows = compareRows(base);
    expect(rows).toHaveLength(9);
    const h2new = rows.find((r) => r.protocol === 'h2-tls13' && r.state === 'new');
    expect(h2new?.total).toBe(1060);
  });
});
