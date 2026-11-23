import { type OtpConfig, evaluate, hitProbability, keyspaceOf, sendsPerNumber } from './model';

const DEFAULT: OtpConfig = {
  scenario: 'brute',
  digits: 6,
  attemptLimit: 10,
  resetOnResend: false,
  invalidateOnResend: true,
  ttlSec: 180,
  cooldownSec: 30,
  sendLimitPerNumber: 10,
  sendLimitPerIp: 100,
};

const withCfg = (patch: Partial<OtpConfig>): OtpConfig => ({ ...DEFAULT, ...patch });

describe('인증번호 모델', () => {
  it('6자리는 100만 가지, 8자리는 1억 가지예요', () => {
    expect(keyspaceOf(6)).toBe(1_000_000);
    expect(keyspaceOf(8)).toBe(100_000_000);
  });

  it('추측 한 번에 맞힐 확률은 살아 있는 번호 수를 경우의 수로 나눈 값이에요', () => {
    expect(hitProbability(1, 1_000_000, 100)).toBeCloseTo(1e-4, 6);
    expect(hitProbability(0, 1_000_000, 100)).toBe(0);
  });

  it('기본값의 무차별 대입은 추측 10번만 가능하고 맞힐 확률은 약 0.001%예요', () => {
    const r = evaluate(DEFAULT);
    expect(r.guesses).toBe(10);
    expect(r.smsSent).toBe(1);
    expect(r.successProbability).toBeCloseTo(1e-5, 7);
  });

  it('시도 한도가 없으면 3분 동안 초당 20번 추측해 3,600번이 가능해요', () => {
    const r = evaluate(withCfg({ attemptLimit: null }));
    expect(r.guesses).toBe(3600);
    expect(r.successProbability).toBeCloseTo(0.0036, 3);
  });

  it('재전송 간격이 30초면 공격 10분 동안 번호를 최대 21번 보낼 수 있어요', () => {
    expect(sendsPerNumber(withCfg({ sendLimitPerNumber: null }))).toBe(21);
    expect(sendsPerNumber(withCfg({ cooldownSec: 120, sendLimitPerNumber: null }))).toBe(6);
  });

  it('재전송 때 실패 횟수를 유지하면 발송을 늘려도 추측 횟수는 시도 한도에서 멈춰요', () => {
    const r = evaluate(withCfg({ scenario: 'resend', resetOnResend: false, sendLimitPerNumber: null }));
    expect(r.smsSent).toBe(21);
    expect(r.guesses).toBe(10);
  });

  it('재전송 때 실패 횟수를 초기화하고 발송 한도가 10번이면 추측은 100번이 돼요', () => {
    const r = evaluate(withCfg({ scenario: 'resend', resetOnResend: true }));
    expect(r.smsSent).toBe(10);
    expect(r.activeCodes).toBe(1);
    expect(r.guesses).toBe(100);
    expect(r.successProbability).toBeCloseTo(1e-4, 6);
  });

  it('재전송 때 이전 번호를 살려 두면 살아 있는 번호 6개가 동시에 대상이 돼요', () => {
    const r = evaluate(withCfg({ scenario: 'resend', resetOnResend: true, invalidateOnResend: false }));
    expect(r.activeCodes).toBe(6);
    expect(r.guesses).toBe(100);
    expect(r.successProbability).toBeCloseTo(1 - (1 - 6e-6) ** 100, 9);
    expect(r.successProbability).toBeCloseTo(6e-4, 5);
  });

  it('재전송 간격과 발송 한도가 없으면 실패 횟수 초기화로 약 1.2%까지 올라가요', () => {
    const r = evaluate(
      withCfg({
        scenario: 'resend',
        resetOnResend: true,
        attemptLimit: null,
        cooldownSec: 0,
        sendLimitPerNumber: null,
        sendLimitPerIp: null,
      }),
    );
    expect(r.smsSent).toBe(601);
    expect(r.guesses).toBe(12_020);
    expect(r.successProbability).toBeCloseTo(0.0119, 3);
  });

  it('문자 폭탄은 번호 10개의 발송을 합치고 IP 한도에서 멈춰요', () => {
    expect(evaluate(withCfg({ scenario: 'bomb' })).smsSent).toBe(100);
    expect(evaluate(withCfg({ scenario: 'bomb', sendLimitPerNumber: null })).smsSent).toBe(100);
    expect(evaluate(withCfg({ scenario: 'bomb', sendLimitPerNumber: null, sendLimitPerIp: null })).smsSent).toBe(210);
    expect(
      evaluate(withCfg({ scenario: 'bomb', sendLimitPerNumber: null, sendLimitPerIp: null, cooldownSec: 0 })).smsSent,
    ).toBe(6010);
  });

  it('문자 폭탄은 추측하지 않으므로 맞힐 확률이 0이에요', () => {
    const r = evaluate(withCfg({ scenario: 'bomb' }));
    expect(r.guesses).toBe(0);
    expect(r.successProbability).toBe(0);
  });
});
