export type Strategy = 'naive' | 'conditional' | 'unique' | 'skip-locked';

export const STRATEGIES: readonly { id: Strategy; label: string; summary: string }[] = [
  {
    id: 'naive',
    label: '읽고 나서 쓰기',
    summary: '먼저 좌석 상태를 읽고, 비어 있으면 그대로 써요. 읽은 뒤 다른 사람이 먼저 써도 확인하지 않아요.',
  },
  {
    id: 'conditional',
    label: '조건부 UPDATE',
    summary: 'WHERE 에 "비어 있을 때만" 을 넣어 한 문장으로 바꿔요. 영향받은 행 수가 0 이면 409 로 답해요.',
  },
  {
    id: 'unique',
    label: 'UNIQUE 제약',
    summary: '좌석마다 예약 행을 하나만 허용해요. 두 번째 INSERT 는 제약 위반으로 실패해요.',
  },
  {
    id: 'skip-locked',
    label: 'SKIP LOCKED 자동 배정',
    summary: '좌석을 고르지 않고 "아무 자리나 한 석"을 요청해요. 다른 사람이 잠근 행은 건너뛰어요.',
  },
];

export const DEFAULT_TTL = 20;

export interface Config {
  readonly strategy: Strategy;
  readonly users: number;
  readonly seats: number;
  readonly ttl: number;
  readonly expiry: boolean;
  readonly seed: number;
}

export interface Plan {
  /** naive · conditional · unique 는 노리는 좌석이 있어요. skip-locked 는 null 이에요 */
  readonly target: number | null;
  readonly startAt: number;
  /** 보류만 하고 결제하지 않아요 */
  readonly abandon: boolean;
  /** 보류 뒤 결제 콜백이 도착하기까지 걸리는 틱 */
  readonly payDelay: number;
}

export type SeatView = 'AVAILABLE' | 'HELD' | 'SOLD';

interface SeatRow {
  holder: number | null;
  heldUntil: number;
  sold: boolean;
}

export interface SeatSnapshot {
  readonly view: SeatView;
  readonly holder: number | null;
}

export type LogKind = 'info' | 'hold' | 'conflict' | 'double' | 'released' | 'sold' | 'refund';

export interface Stats {
  readonly holds: number;
  readonly conflicts: number;
  readonly doubleBookings: number;
  readonly roundTrips: number;
  readonly released: number;
  readonly sold: number;
  readonly refunds: number;
}

export interface Frame {
  readonly now: number;
  readonly kind: LogKind;
  readonly text: string;
  readonly seats: readonly SeatSnapshot[];
  readonly stats: Stats;
}

export interface SimResult {
  readonly frames: readonly Frame[];
}

type Phase = 'read' | 'hold' | 'cleanup' | 'insert' | 'lock' | 'update' | 'confirm' | 'done';

interface User {
  readonly id: number;
  readonly plan: Plan;
  phase: Phase;
  wakeAt: number;
  seat: number | null;
}

const START_PHASE: Record<Strategy, Phase> = {
  naive: 'read',
  conditional: 'hold',
  unique: 'cleanup',
  'skip-locked': 'lock',
};

/** 같은 시드면 같은 계획이 나와요. 사용자마다 노리는 좌석, 결제 여부, 결제까지 걸리는 시간을 정해요 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePlans(config: Config): Plan[] {
  const random = mulberry32(config.seed);
  return Array.from({ length: config.users }, () => {
    const target = config.strategy === 'skip-locked' ? null : Math.floor(random() * config.seats);
    const abandon = random() < 0.3;
    const payDelay = 1 + Math.floor(random() * config.ttl * 2);
    return { target, startAt: 0, abandon, payDelay };
  });
}

export function seatView(seat: Readonly<SeatRow>, now: number): SeatView {
  if (seat.sold) return 'SOLD';
  return seat.holder !== null && now <= seat.heldUntil ? 'HELD' : 'AVAILABLE';
}

const must = (seat: number | null): number => {
  if (seat === null) throw new Error('좌석이 정해지지 않았어요');
  return seat;
};

export function simulate(config: Config, plans: readonly Plan[] = makePlans(config)): SimResult {
  const seats: SeatRow[] = Array.from({ length: config.seats }, () => ({
    holder: null,
    heldUntil: 0,
    sold: false,
  }));
  const locks = new Set<number>();
  const users: User[] = plans.map((plan, id) => ({
    id,
    plan,
    phase: START_PHASE[config.strategy],
    wakeAt: plan.startAt,
    seat: plan.target,
  }));
  const stats = { holds: 0, conflicts: 0, doubleBookings: 0, roundTrips: 0, released: 0, sold: 0, refunds: 0 };
  const frames: Frame[] = [];

  const snapshot = (now: number): SeatSnapshot[] => seats.map((s) => ({ view: seatView(s, now), holder: s.holder }));
  const emit = (now: number, kind: LogKind, text: string) => {
    frames.push({ now, kind, text, seats: snapshot(now), stats: { ...stats } });
  };
  const who = (u: User) => `사용자 ${u.id + 1}`;
  const seatName = (i: number) => `${i + 1}번 좌석`;
  const deadline = (now: number) => (config.expiry ? now + config.ttl : Number.POSITIVE_INFINITY);

  /** 보류 행을 쓴다. 호출한 쪽이 결과 기록을 맡는다 */
  const write = (u: User, idx: number, now: number): { reclaimed: boolean } => {
    const seat = seats[idx];
    const reclaimed = seat.holder !== null && !seat.sold && now > seat.heldUntil;
    seat.holder = u.id;
    seat.heldUntil = deadline(now);
    seat.sold = false;
    stats.holds += 1;
    if (reclaimed) stats.released += 1;
    u.seat = idx;
    u.wakeAt = now + u.plan.payDelay;
    u.phase = u.plan.abandon ? 'done' : 'confirm';
    return { reclaimed };
  };

  const holdText = (u: User, idx: number, now: number, reclaimed: boolean): string => {
    const until = config.expiry ? `${now + config.ttl} 틱까지 보류` : '만료 없이 보류';
    const note = reclaimed ? ' (만료된 보류를 이어받았어요)' : '';
    const leave = u.plan.abandon ? '. 결제하지 않고 떠나요' : '';
    return `${who(u)} · ${seatName(idx)} 보류 성공, ${until}${note}${leave}`;
  };

  const hold = (u: User, idx: number, now: number): void => {
    const { reclaimed } = write(u, idx, now);
    emit(now, reclaimed ? 'released' : 'hold', holdText(u, idx, now, reclaimed));
  };

  const refuse = (u: User, now: number, reason: string): void => {
    stats.conflicts += 1;
    u.phase = 'done';
    emit(now, 'conflict', `${who(u)} · ${reason} → 409`);
  };

  const exec = (u: User, now: number): void => {
    stats.roundTrips += 1;
    switch (u.phase) {
      case 'read': {
        const idx = must(u.seat);
        if (seatView(seats[idx], now) !== 'AVAILABLE') {
          refuse(u, now, `${seatName(idx)} 조회: 이미 잡혀 있어요`);
          return;
        }
        u.phase = 'hold';
        emit(now, 'info', `${who(u)} · ${seatName(idx)} 조회: 비어 있어요`);
        return;
      }
      case 'hold': {
        const idx = must(u.seat);
        if (config.strategy === 'naive') {
          const seat = seats[idx];
          const previous = seat.holder;
          const taken = seat.sold || (previous !== null && previous !== u.id && now <= seat.heldUntil);
          if (!taken) {
            hold(u, idx, now);
            return;
          }
          stats.doubleBookings += 1;
          write(u, idx, now);
          emit(
            now,
            'double',
            `${who(u)} 가 ${seatName(idx)} 를 덮어썼어요. 사용자 ${(previous ?? 0) + 1} 의 보류가 사라졌어요 (이중 예약)`,
          );
          return;
        }
        if (seatView(seats[idx], now) !== 'AVAILABLE') {
          refuse(u, now, `${seatName(idx)} 보류: 조건에 맞는 행이 없어요 (영향 0 행)`);
          return;
        }
        hold(u, idx, now);
        return;
      }
      case 'cleanup': {
        const idx = must(u.seat);
        const seat = seats[idx];
        if (seat.holder !== null && !seat.sold && now > seat.heldUntil) {
          stats.released += 1;
          seat.holder = null;
          seat.heldUntil = 0;
          emit(now, 'info', `${who(u)} · 만료된 ${seatName(idx)} 예약 행을 지웠어요`);
        } else {
          emit(now, 'info', `${who(u)} · ${seatName(idx)} 에 지울 만료 행이 없어요`);
        }
        u.phase = 'insert';
        return;
      }
      case 'insert': {
        const idx = must(u.seat);
        if (seats[idx].holder !== null) {
          refuse(u, now, `${seatName(idx)} INSERT: UNIQUE 제약 위반`);
          return;
        }
        hold(u, idx, now);
        return;
      }
      case 'lock': {
        const idx = seats.findIndex((s, i) => !locks.has(i) && seatView(s, now) === 'AVAILABLE');
        if (idx < 0) {
          refuse(u, now, '잠기지 않은 빈 좌석이 없어요');
          return;
        }
        locks.add(idx);
        u.seat = idx;
        u.phase = 'update';
        emit(now, 'info', `${who(u)} · ${seatName(idx)} 를 잠가요 (SKIP LOCKED: 잠긴 행은 건너뛰어요)`);
        return;
      }
      case 'update': {
        const idx = must(u.seat);
        locks.delete(idx);
        hold(u, idx, now);
        return;
      }
      case 'confirm': {
        const idx = must(u.seat);
        const seat = seats[idx];
        u.phase = 'done';
        if (seat.holder === u.id && !seat.sold && now <= seat.heldUntil) {
          seat.sold = true;
          stats.sold += 1;
          emit(now, 'sold', `${who(u)} · ${seatName(idx)} 결제 확정`);
          return;
        }
        stats.refunds += 1;
        const why = seat.holder === u.id ? '보류 시간이 지나' : '다른 사람이 같은 좌석을 가져가';
        emit(now, 'refund', `${who(u)} · 결제 콜백이 도착했지만 ${why} 환불해요`);
        return;
      }
      case 'done':
        return;
    }
  };

  emit(0, 'info', '처음 상태예요. 모든 좌석이 비어 있어요.');
  const random = mulberry32(config.seed ^ 0x5bd1e995);
  let clock = 0;
  let guard = 0;
  while (users.some((u) => u.phase !== 'done')) {
    guard += 1;
    if (guard > 1_000_000) throw new Error('시뮬레이션이 끝나지 않았어요');
    const ready = users.filter((u) => u.phase !== 'done' && u.wakeAt <= clock);
    if (ready.length === 0) {
      clock += 1;
      continue;
    }
    exec(ready[Math.floor(random() * ready.length)], clock);
    clock += 1;
  }
  return { frames };
}
