import { Checkbox, RadioGroup, Tag, Textarea } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  type Config,
  evaluate,
  type HstsValue,
  POLICY_PRESETS,
  type ReferrerValue,
  REFERRER_VALUES,
  RESOURCES,
  type ResourceId,
  type SentOver,
  type Verdict,
  type XfoValue,
} from './model';
import './Simulator.css';

const VERDICT_LABEL: Record<Verdict, string> = {
  allowed: '허용',
  blocked: '차단',
  reported: '보고만',
  skipped: '건너뜀',
};

const XFO_OPTIONS: readonly { value: XfoValue; label: string }[] = [
  { value: 'none', label: 'X-Frame-Options 없음' },
  { value: 'DENY', label: 'X-Frame-Options: DENY' },
  { value: 'SAMEORIGIN', label: 'X-Frame-Options: SAMEORIGIN' },
];

const HSTS_OPTIONS: readonly { value: HstsValue; label: string }[] = [
  { value: 'none', label: 'HSTS 없음' },
  { value: 'basic', label: 'max-age=31536000' },
  { value: 'subdomains', label: 'max-age=31536000; includeSubDomains' },
];

const SENT_OPTIONS: readonly { value: SentOver; label: string }[] = [
  { value: 'https', label: 'HTTPS 응답에 실어 보냄' },
  { value: 'http', label: 'HTTP 응답에 실어 보냄' },
];

const NEXT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'http://shop.example/cart', label: 'http://shop.example/cart' },
  { value: 'http://api.shop.example/api/cart', label: 'http://api.shop.example/api/cart' },
];

const REFERRER_LABEL: Record<ReferrerValue, string> = {
  'no-referrer': 'no-referrer',
  origin: 'origin',
  'same-origin': 'same-origin',
  'strict-origin-when-cross-origin': 'strict-origin-when-cross-origin (기본값)',
  'unsafe-url': 'unsafe-url',
};

const RESOURCE_LABEL: Record<ResourceId, string> = Object.fromEntries(RESOURCES.map((r) => [r.id, r.label])) as Record<
  ResourceId,
  string
>;

const toggle = <T,>(list: readonly T[], item: T, on: boolean): T[] =>
  on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item);

export default function Simulator() {
  const groupId = useId();
  const [presetId, setPresetId] = useState<string>('nonce');
  const [policy, setPolicy] = useState<string>(POLICY_PRESETS[0].text);
  const [reportOnly, setReportOnly] = useState(false);
  const [xfo, setXfo] = useState<XfoValue>('none');
  const [nosniff, setNosniff] = useState(true);
  const [hsts, setHsts] = useState<HstsValue>('none');
  const [hstsSentOver, setHstsSentOver] = useState<SentOver>('https');
  const [nextRequest, setNextRequest] = useState<string>(NEXT_OPTIONS[0].value);
  const [referrer, setReferrer] = useState<ReferrerValue>('strict-origin-when-cross-origin');
  const [loaded, setLoaded] = useState<ResourceId[]>(RESOURCES.map((r) => r.id));

  const cfg: Config = {
    policy,
    reportOnly,
    xfo,
    nosniff,
    hsts,
    hstsSentOver,
    nextRequest,
    referrer,
    loaded,
  };
  const r = evaluate(cfg);

  const presetOptions = [
    ...POLICY_PRESETS.map((p) => ({ value: p.id, label: p.label })),
    { value: 'custom', label: '직접 고친 값' },
  ];

  const pickPreset = (id: string) => {
    setPresetId(id);
    const preset = POLICY_PRESETS.find((p) => p.id === id);
    if (preset) setPolicy(preset.text);
  };

  const onPolicyChange = (text: string) => {
    setPolicy(text);
    const same = POLICY_PRESETS.find((p) => p.text === text);
    setPresetId(same ? same.id : 'custom');
  };

  const verdictLine =
    r.blocked === 0 && r.reported === 0
      ? '이번 요청에서 막힌 자원이 없어요.'
      : `막힌 자원이 ${r.blocked}개 있어요.${r.reported > 0 ? ` 보고만 된 자원이 ${r.reported}개 있어요.` : ''}`;

  return (
    <div className="sh-lab">
      <section className="sh-lab__panel" aria-labelledby={`${groupId}-csp`}>
        <h3 id={`${groupId}-csp`}>Content-Security-Policy</h3>
        <RadioGroup
          label="정책 프리셋"
          options={presetOptions}
          value={presetId}
          onValueChange={(v) => {
            if (v !== 'custom') pickPreset(v);
          }}
        />
        <Textarea
          label="정책 문자열"
          value={policy}
          onChange={(e) => onPolicyChange(e.target.value)}
          rows={4}
          helper="지시문은 세미콜론으로 나눠요. 같은 지시문이 두 번 나오면 첫 번째만 써요."
        />
        <Checkbox
          label="Content-Security-Policy-Report-Only 로 보내기 (막지 않고 보고만 해요)"
          checked={reportOnly}
          onCheckedChange={(on) => setReportOnly(on === true)}
        />
      </section>

      <section className="sh-lab__panel" aria-labelledby={`${groupId}-hdr`}>
        <h3 id={`${groupId}-hdr`}>다른 보안 헤더</h3>
        <RadioGroup
          label="X-Frame-Options"
          options={XFO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={xfo}
          onValueChange={setXfo}
        />
        <Checkbox
          label="X-Content-Type-Options: nosniff"
          checked={nosniff}
          onCheckedChange={(on) => setNosniff(on === true)}
        />
        <RadioGroup
          label="Strict-Transport-Security"
          options={HSTS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={hsts}
          onValueChange={setHsts}
        />
        <RadioGroup
          label="HSTS 헤더를 받은 응답 경로"
          options={SENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={hstsSentOver}
          onValueChange={setHstsSentOver}
        />
        <RadioGroup
          label="다음에 보낼 요청 (http)"
          options={NEXT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={nextRequest}
          onValueChange={setNextRequest}
        />
        <RadioGroup
          label="Referrer-Policy"
          options={REFERRER_VALUES.map((v) => ({ value: v, label: REFERRER_LABEL[v] }))}
          value={referrer}
          onValueChange={setReferrer}
        />
      </section>

      <section className="sh-lab__panel" aria-labelledby={`${groupId}-load`}>
        <h3 id={`${groupId}-load`}>페이지가 로드하려는 자원</h3>
        <div className="sh-lab__checks">
          {RESOURCES.map((res) => (
            <Checkbox
              key={res.id}
              label={RESOURCE_LABEL[res.id]}
              checked={loaded.includes(res.id)}
              onCheckedChange={(on) => setLoaded((cur) => toggle(cur, res.id, on === true))}
            />
          ))}
        </div>
      </section>

      <section className="sh-lab__results" aria-label="판정 결과">
        <p className="sh-lab__verdict" role="status">
          {verdictLine}
        </p>

        <ol className="sh-steps">
          {r.resources.map((res) => (
            <li key={res.id} className="sh-steps__item" data-verdict={res.verdict}>
              <div className="sh-steps__head">
                <Tag variant={res.verdict === 'blocked' ? 'accent' : undefined}>{VERDICT_LABEL[res.verdict]}</Tag>
                <strong>{res.label}</strong>
              </div>
              {res.verdict !== 'skipped' && <p>{res.reason}</p>}
            </li>
          ))}
        </ol>

        <div className="sh-lab__stats">
          <div className="sh-lab__block">
            <span>HSTS 판정</span>
            <p>{r.hsts.reason}</p>
            <code>
              {r.hsts.requestUrl} → {r.hsts.finalUrl}
            </code>
          </div>
          <div className="sh-lab__block">
            <span>교차 출처 fetch 의 Referer</span>
            <code>{r.referrerSent ?? '보내지 않아요'}</code>
          </div>
        </div>

        <p className="sh-lab__note">
          이 시뮬레이터는 판정 규칙만 보여 줘요. 실제 브라우저는 세부 구현이 다를 수 있고, 페이지 안의 다른 자원과
          strict-dynamic 같은 지시문은 계산하지 않아요.
        </p>
      </section>
    </div>
  );
}
