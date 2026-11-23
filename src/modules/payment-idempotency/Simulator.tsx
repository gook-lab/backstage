import { Alert, Button, Checkbox, RadioGroup, Tag } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  PRESETS,
  simulate,
  verdictOf,
  type ClientView,
  type Config,
  type Lane,
  type Protection,
  type TimeoutPolicy,
} from './model';
import './Simulator.css';

const LANE_LABEL: Record<Lane, string> = {
  client: '클라이언트',
  server: '서버',
  provider: '카드사',
  webhook: '웹훅',
  network: '네트워크',
};

const LANE_TAG: Record<Lane, 'accent' | 'neutral' | 'outline'> = {
  client: 'neutral',
  server: 'accent',
  provider: 'outline',
  webhook: 'neutral',
  network: 'outline',
};

const TIMEOUT_OPTIONS: { value: TimeoutPolicy; label: string }[] = [
  { value: 'wait', label: '기다리기 (결과를 모름)' },
  { value: 'resubmit', label: '자동 재전송 (한 번)' },
  { value: 'poll', label: '상태 조회 (다시 보내지 않아요)' },
];

const PROTECTION_OPTIONS: { value: Protection; label: string }[] = [
  { value: 'none', label: '보호 없음' },
  { value: 'key', label: '멱등성 키' },
  { value: 'key-webhook', label: '멱등성 키 + 웹훅 중복 제거' },
];

const VIEW_LABEL: Record<ClientView, string> = {
  unknown: '확인 중 (UNKNOWN)',
  confirmed: '완료 화면',
  rejected: '실패 화면',
};

export default function Simulator() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [config, setConfig] = useState<Config>(PRESETS[0].config);
  const [cut, setCut] = useState<number | null>(null);

  const result = useMemo(() => simulate(config), [config]);
  const verdict = verdictOf(result);
  const total = result.events.length;
  const shown = cut === null ? total : Math.min(cut, total);

  const update = (patch: Partial<Config>) => {
    setPresetId('');
    setCut(null);
    setConfig((current) => ({ ...current, ...patch }));
  };

  const choose = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setCut(null);
    setConfig(preset.config);
  };

  const stats: [string, string][] = [
    ['보낸 결제 요청', `${result.sends}번`],
    ['카드사 승인', `${result.providerCharges}번`],
    ['주문 결제 완료', `${result.paidOrders}건`],
    ['결제 완료 알림', `${result.notifications}번`],
    ['중복 웹훅 처리', `${result.duplicateWebhooksProcessed}번`],
    ['고객 화면', VIEW_LABEL[result.clientView]],
  ];

  return (
    <div className="pay-lab">
      <RadioGroup
        label="시작 시나리오"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choose}
      />

      <div className="pay-lab__controls">
        <fieldset className="pay-lab__group">
          <legend>클라이언트와 네트워크</legend>
          <Checkbox
            label="더블 클릭 (같은 시도의 두 번째 요청을 조금 뒤 보내요)"
            checked={config.doubleClick}
            onCheckedChange={(v) => update({ doubleClick: v === true })}
          />
          <RadioGroup
            label="응답이 오지 않을 때"
            options={TIMEOUT_OPTIONS}
            value={config.timeoutPolicy}
            onValueChange={(v) => update({ timeoutPolicy: v })}
          />
          <Checkbox
            label="재전송할 때 금액을 바꿔요 (쿠폰 적용 등)"
            checked={config.retryChangesBody}
            onCheckedChange={(v) => update({ retryChangesBody: v === true })}
          />
          <label className="pay-lab__range">
            <span>응답 유실 비율 {config.lossPercent}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={25}
              value={config.lossPercent}
              onChange={(e) => update({ lossPercent: Number(e.target.value) })}
            />
          </label>
          <div className="pay-lab__dice">
            <span>주사위 {config.seed}</span>
            <Button variant="ghost" size="sm" onClick={() => update({ seed: config.seed + 1 })}>
              주사위 다시 굴리기
            </Button>
          </div>
        </fieldset>

        <fieldset className="pay-lab__group">
          <legend>서버 보호</legend>
          <RadioGroup
            label="서버가 하는 일"
            options={PROTECTION_OPTIONS}
            value={config.protection}
            onValueChange={(v) => update({ protection: v })}
          />
          <Checkbox
            label="웹훅을 두 번 보내요 (중복 전송)"
            checked={config.webhookDuplicates}
            onCheckedChange={(v) => update({ webhookDuplicates: v === true })}
          />
        </fieldset>
      </div>

      <section className="pay-lab__result" aria-labelledby="pay-result-title">
        <h3 id="pay-result-title">결과</h3>
        <dl className="pay-stats">
          {stats.map(([label, value]) => (
            <div className="pay-stat" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div aria-live="polite">
          <Alert tone={verdict.tone} title={verdict.title} />
        </div>
      </section>

      <section className="pay-lab__timeline" aria-labelledby="pay-timeline-title">
        <h3 id="pay-timeline-title">타임라인</h3>
        <label className="pay-lab__range">
          <span>
            {shown} / {total} 단계 보기
          </span>
          <input type="range" min={0} max={total} value={shown} onChange={(e) => setCut(Number(e.target.value))} />
        </label>
        <ol className="pay-timeline">
          {result.events.slice(0, shown).map((e, i) => (
            <li className="pay-timeline__item" data-lane={e.lane} key={i}>
              <span className="pay-timeline__t">t={e.t}</span>
              <Tag variant={LANE_TAG[e.lane]}>{LANE_LABEL[e.lane]}</Tag>
              <span className="pay-timeline__text">{e.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
