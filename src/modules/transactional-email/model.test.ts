import { describe, expect, it } from 'vitest';
import { type Params, RESEND_NOTICE, type RetryPolicy, type Sender, resendRequest, simulateMail } from './model';

const GOOD: Sender = { spf: 'pass', dkim: 'pass', aligned: true, dmarc: 'reject' };
const RETRIES: RetryPolicy[] = ['none', 'fixed', 'backoff'];
const base: Params = { recipient: 'ok', busyMinutes: 6, sender: GOOD, retry: 'backoff' };

describe('수신 상태별 결과', () => {
  it('정상 수신자는 첫 시도에 전달돼요', () => {
    const r = simulateMail(base);
    expect(r.outcome).toBe('delivered');
    expect(r.attempts).toEqual([{ minute: 0, reply: 'ok' }]);
  });

  it.each(RETRIES)('없는 주소는 %s 정책에서도 재시도 없이 반송돼요', (retry) => {
    const r = simulateMail({ ...base, recipient: 'missing', retry });
    expect(r.outcome).toBe('bounced');
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0].reply).toBe('5yz');
  });

  it('일시 거절이 짧으면 고정 간격 재시도가 6분째에 전달해요', () => {
    const r = simulateMail({ ...base, recipient: 'busy', busyMinutes: 6, retry: 'fixed' });
    expect(r.outcome).toBe('retried');
    expect(r.deliveredAt).toBe(6);
    expect(r.attempts.map((a) => a.reply)).toEqual(['4yz', '4yz', 'ok']);
  });

  it('재시도 없이 4yz 를 받으면 반송이 아니라 유실로 끝나요', () => {
    const r = simulateMail({ ...base, recipient: 'busy', busyMinutes: 1, retry: 'none' });
    expect(r.outcome).toBe('lost');
    expect(r.deliveredAt).toBeNull();
  });

  it('일시 거절이 길면 고정 간격은 포기하고, 백오프는 뒤늦게 전달해요', () => {
    const fixed = simulateMail({ ...base, recipient: 'busy', busyMinutes: 13, retry: 'fixed' });
    const backoff = simulateMail({ ...base, recipient: 'busy', busyMinutes: 13, retry: 'backoff' });
    expect(fixed.outcome).toBe('lost');
    expect(backoff.outcome).toBe('retried');
    expect(backoff.deliveredAt).toBe(15);
  });

  it('일시 거절이 백오프 시도 범위를 넘으면 백오프도 유실이에요', () => {
    const r = simulateMail({ ...base, recipient: 'busy', busyMinutes: 20, retry: 'backoff' });
    expect(r.outcome).toBe('lost');
    expect(r.attempts.every((a) => a.reply === '4yz')).toBe(true);
  });
});

describe('발신 인증과 DMARC 정책', () => {
  it('정렬이 맞고 SPF 나 DKIM 중 하나가 통과하면 DMARC 가 통과해요', () => {
    expect(simulateMail({ ...base, sender: { ...GOOD, spf: 'fail', dkim: 'pass' } }).outcome).toBe('delivered');
  });

  it('SPF 가 통과해도 From 과 정렬이 안 맞으면 quarantine 에서 스팸함 가능성이 생겨요', () => {
    const r = simulateMail({ ...base, sender: { spf: 'pass', dkim: 'fail', aligned: false, dmarc: 'quarantine' } });
    expect(r.outcome).toBe('spam');
    expect(r.deliveredAt).toBe(0);
  });

  it('DMARC 정책이 none 이면 인증이 실패해도 전달 결과는 그대로예요', () => {
    const r = simulateMail({ ...base, sender: { spf: 'fail', dkim: 'fail', aligned: true, dmarc: 'none' } });
    expect(r.outcome).toBe('delivered');
  });

  it('DMARC 정책이 reject 이고 인증이 실패하면 반송돼요', () => {
    const r = simulateMail({ ...base, sender: { spf: 'fail', dkim: 'fail', aligned: true, dmarc: 'reject' } });
    expect(r.outcome).toBe('bounced');
    expect(r.attempts[0].reply).toBe('5yz');
  });
});

describe('다시 보내기 응답', () => {
  it('쿨다운 안에서는 계정 존재와 무관하게 같은 대기 문구를 받아요', () => {
    const existing = resendRequest({ accountExists: true, lastRequestedAt: 0, now: 1, cooldown: 3 });
    const missing = resendRequest({ accountExists: false, lastRequestedAt: 0, now: 1, cooldown: 3 });
    expect(existing.message).toBe(missing.message);
    expect(existing.waitMinutes).toBe(2);
    expect(existing.mailSent).toBe(false);
    expect(missing.mailSent).toBe(false);
  });

  it('쿨다운이 끝나면 계정 존재와 무관하게 같은 접수 문구를 받고, 메일은 있는 계정에만 나가요', () => {
    const existing = resendRequest({ accountExists: true, lastRequestedAt: 0, now: 3, cooldown: 3 });
    const missing = resendRequest({ accountExists: false, lastRequestedAt: 0, now: 3, cooldown: 3 });
    expect(existing.message).toBe(RESEND_NOTICE);
    expect(missing.message).toBe(RESEND_NOTICE);
    expect(existing.mailSent).toBe(true);
    expect(missing.mailSent).toBe(false);
  });

  it('처음 요청은 대기 없이 접수돼요', () => {
    const r = resendRequest({ accountExists: true, lastRequestedAt: null, now: 0, cooldown: 3 });
    expect(r.waitMinutes).toBe(0);
    expect(r.mailSent).toBe(true);
  });
});
