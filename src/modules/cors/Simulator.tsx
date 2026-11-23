import { Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  ALLOW_HEADER_LIST,
  ALLOW_METHOD_LIST,
  ALLOW_ORIGIN_VALUE,
  type AllowHeaders,
  type AllowMethods,
  type AllowOrigin,
  type Credentials,
  evaluate,
  type Input,
  METHODS,
  type Method,
  REQ_HEADER_LABEL,
  REQ_HEADERS,
  RESP_HEADERS,
  type ReqHeader,
  type RespHeader,
  type StepStatus,
  TARGETS,
  type TargetId,
} from './model';
import './Simulator.css';

const STATUS_LABEL: Record<StepStatus, string> = {
  pass: '통과',
  fail: '막힘',
  skip: '건너뜀',
  info: '정보',
  warn: '주의',
};

const ORIGIN_OPTIONS: readonly { value: AllowOrigin; label: string }[] = [
  { value: 'none', label: 'Allow-Origin 없음' },
  { value: 'wildcard', label: 'Allow-Origin *' },
  { value: 'echo', label: `Allow-Origin 요청 출처 (${ALLOW_ORIGIN_VALUE.echo})` },
  { value: 'other', label: `Allow-Origin 다른 출처 (${ALLOW_ORIGIN_VALUE.other})` },
];

const METHOD_OPTIONS: readonly { value: AllowMethods; label: string }[] = [
  { value: 'none', label: 'Allow-Methods 없음' },
  { value: 'list', label: `Allow-Methods ${ALLOW_METHOD_LIST.join(', ')}` },
  { value: 'wildcard', label: 'Allow-Methods *' },
];

const HEADER_OPTIONS: readonly { value: AllowHeaders; label: string }[] = [
  { value: 'none', label: 'Allow-Headers 없음' },
  { value: 'list', label: `Allow-Headers ${ALLOW_HEADER_LIST.join(', ')}` },
  { value: 'list-auth', label: `Allow-Headers ${ALLOW_HEADER_LIST.join(', ')}, Authorization` },
  { value: 'wildcard', label: 'Allow-Headers *' },
];

const MAX_AGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'default', label: 'Max-Age 없음 (기본 5초)' },
  { value: '600', label: 'Max-Age 600초' },
];

const CREDENTIAL_OPTIONS: readonly { value: Credentials; label: string }[] = [
  { value: 'omit', label: '자격 증명 없이' },
  { value: 'include', label: '쿠키 포함 (credentials: include)' },
];

const toggle = <T,>(list: readonly T[], item: T, on: boolean): T[] =>
  on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item);

export default function Simulator() {
  const groupId = useId();
  const [target, setTarget] = useState<TargetId>('subdomain');
  const [method, setMethod] = useState<Method>('POST');
  const [headers, setHeaders] = useState<ReqHeader[]>(['json']);
  const [credentials, setCredentials] = useState<Credentials>('omit');
  const [allowOrigin, setAllowOrigin] = useState<AllowOrigin>('none');
  const [allowCredentials, setAllowCredentials] = useState(false);
  const [allowMethods, setAllowMethods] = useState<AllowMethods>('none');
  const [allowHeaders, setAllowHeaders] = useState<AllowHeaders>('none');
  const [maxAgeChoice, setMaxAgeChoice] = useState<string>('default');
  const [expose, setExpose] = useState<RespHeader[]>([]);
  const [vary, setVary] = useState(false);

  const input: Input = {
    target,
    method,
    headers,
    credentials,
    allowOrigin,
    allowCredentials,
    allowMethods,
    allowHeaders,
    maxAge: maxAgeChoice === 'default' ? null : Number(maxAgeChoice),
    expose,
    vary,
  };
  const r = evaluate(input);

  const verdict = !r.cross
    ? '같은 출처라서 CORS 가 관여하지 않아요.'
    : !r.actualSent
      ? '실제 요청은 나가지 않았어요. 서버는 OPTIONS 만 받았어요.'
      : r.readable
        ? 'JS 가 응답을 읽을 수 있어요.'
        : '요청은 서버에 도달했지만 JS 는 응답을 읽을 수 없어요.';

  const serverSaw =
    r.optionsReached && r.actualSent ? 'OPTIONS + 실제 요청' : r.optionsReached ? 'OPTIONS 만' : '실제 요청';

  return (
    <div className="cs-lab">
      <section className="cs-lab__panel" aria-labelledby={`${groupId}-req`}>
        <h3 id={`${groupId}-req`}>요청 설정</h3>
        <RadioGroup
          label="요청 대상 (페이지 출처 https://shop.example)"
          options={TARGETS.map((t) => ({ value: t.id, label: t.label }))}
          value={target}
          onValueChange={setTarget}
        />
        <RadioGroup
          label="메서드"
          options={METHODS.map((m) => ({ value: m, label: m }))}
          value={method}
          onValueChange={setMethod}
        />
        <div className="cs-lab__checks">
          {REQ_HEADERS.map((h) => (
            <Checkbox
              key={h}
              label={REQ_HEADER_LABEL[h]}
              checked={headers.includes(h)}
              onCheckedChange={(on) => setHeaders((cur) => toggle(cur, h, on === true))}
            />
          ))}
        </div>
        <RadioGroup
          label="자격 증명"
          options={CREDENTIAL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={credentials}
          onValueChange={setCredentials}
        />
      </section>

      <section className="cs-lab__panel" aria-labelledby={`${groupId}-res`}>
        <h3 id={`${groupId}-res`}>서버 응답 설정</h3>
        <RadioGroup
          label="Access-Control-Allow-Origin"
          options={ORIGIN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={allowOrigin}
          onValueChange={setAllowOrigin}
        />
        <div className="cs-lab__checks">
          <Checkbox
            label="Access-Control-Allow-Credentials: true"
            checked={allowCredentials}
            onCheckedChange={(on) => setAllowCredentials(on === true)}
          />
          <Checkbox label="Vary: Origin 포함" checked={vary} onCheckedChange={(on) => setVary(on === true)} />
        </div>
        <RadioGroup
          label="Access-Control-Allow-Methods"
          options={METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={allowMethods}
          onValueChange={setAllowMethods}
        />
        <RadioGroup
          label="Access-Control-Allow-Headers"
          options={HEADER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={allowHeaders}
          onValueChange={setAllowHeaders}
        />
        <RadioGroup
          label="Access-Control-Max-Age"
          options={MAX_AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={maxAgeChoice}
          onValueChange={setMaxAgeChoice}
        />
        <fieldset className="cs-lab__expose">
          <legend>Access-Control-Expose-Headers 에 넣을 응답 헤더</legend>
          <div className="cs-lab__checks">
            {RESP_HEADERS.map((h) => (
              <Checkbox
                key={h}
                label={h}
                checked={expose.includes(h)}
                onCheckedChange={(on) => setExpose((cur) => toggle(cur, h, on === true))}
              />
            ))}
          </div>
          <p className="cs-lab__note">Content-Type 은 기본으로 읽혀요. 나머지 헤더는 여기 체크해야 JS 가 읽어요.</p>
        </fieldset>
      </section>

      <section className="cs-lab__results" aria-label="판정 결과">
        <p className="cs-lab__verdict" role="status">
          {verdict}
        </p>
        <div className="cs-lab__stats">
          <Stat
            label="프리플라이트"
            value={r.preflightNeeded ? (r.preflightPassed ? '보냄 · 통과' : '보냄 · 실패') : '안 보냄'}
          />
          <Stat label="서버가 받은 요청" value={serverSaw} />
          <Stat label="JS 응답 읽기" value={r.readable ? '가능' : '불가'} tone={r.readable ? 'ink' : 'accent'} />
        </div>

        <ol className="cs-steps">
          {r.steps.map((s) => (
            <li key={s.id} className="cs-steps__item" data-status={s.status}>
              <div className="cs-steps__head">
                <Tag variant={s.status === 'fail' ? 'accent' : undefined}>{STATUS_LABEL[s.status]}</Tag>
                <strong>{s.title}</strong>
              </div>
              <p>{s.detail}</p>
            </li>
          ))}
        </ol>

        {r.readable && (
          <p className="cs-lab__note">
            읽을 수 있는 헤더: <code>{r.readableHeaders.join(', ')}</code>
          </p>
        )}

        {r.consoleHint && (
          <div className="cs-lab__console">
            <span>콘솔 문구 예시 (브라우저마다 달라요)</span>
            <code>{r.consoleHint}</code>
          </div>
        )}
        <p className="cs-lab__note">
          이 시뮬레이터는 판정 규칙만 보여 줘요. 실제 응답 시간이나 쿠키 정책은 계산하지 않아요.
        </p>
      </section>
    </div>
  );
}
