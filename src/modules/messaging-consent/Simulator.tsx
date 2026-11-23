import { RadioGroup, Stat } from '@gook-lab/ui';
import { useState } from 'react';
import { CHECK_LABEL, type CheckAt, type Event, EVENT_LABEL, type Item, simulate } from './model';
import './Simulator.css';

const CHECKS: readonly CheckAt[] = ['create', 'send'];
const EVENTS: readonly Event[] = ['none', 'email-off', 'one-click-email', 'forged-one-click', 'sms-off'];

export default function Simulator() {
  const [checkAt, setCheckAt] = useState<CheckAt>('create');
  const [event, setEvent] = useState<Event>('none');

  const result = simulate(checkAt, event);

  return (
    <div className="mc-lab">
      <p className="mc-lab__hint">
        동의를 언제 확인하는지와 사용자에게 일어난 사건을 고르면, 예약된 메시지 세 통이 어떻게 처리되는지 보여요.
      </p>

      <div className="mc-lab__controls">
        <RadioGroup
          label="동의 확인 시점"
          options={CHECKS.map((c) => ({ value: c, label: CHECK_LABEL[c] }))}
          value={checkAt}
          onValueChange={setCheckAt}
        />
        <RadioGroup
          label="사건 (요청 생성 뒤, 발송 전)"
          options={EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))}
          value={event}
          onValueChange={setEvent}
        />
      </div>

      <section className="mc-lab__results" aria-label="결과">
        <Stat label="발송됨" value={result.sent} unit="통" />
        <Stat label="막힘" value={result.blocked} unit="통" />
        <Stat label="동의 위반" value={result.violations} unit="건" tone={result.violations > 0 ? 'accent' : 'ink'} />
      </section>

      <ol className="mc-lab__items" aria-label="메시지 처리">
        {result.items.map((item: Item) => (
          <li
            key={item.id}
            className={item.status === 'blocked' ? 'mc-lab__item mc-lab__item--blocked' : 'mc-lab__item'}
          >
            <span className="mc-lab__item-label">{item.label}</span>
            <span className="mc-lab__item-status">{item.status === 'sent' ? '발송' : '막힘'}</span>
            <span className="mc-lab__item-reason">{item.reason}</span>
          </li>
        ))}
      </ol>

      <p className="mc-lab__note">메시지 수와 순서는 감을 잡기 위한 예시예요. 같은 사용자의 예약 세 통을 가정해요.</p>
    </div>
  );
}
