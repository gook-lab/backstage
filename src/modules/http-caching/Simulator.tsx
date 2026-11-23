import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { type CacheKind, formatSec, judgeBoth, PRESETS, type ResponseHeaders, type Verdict } from './model';
import './Simulator.css';

type FlagKey = {
  [K in keyof ResponseHeaders]: ResponseHeaders[K] extends boolean ? K : never;
}[keyof ResponseHeaders];

const FLAGS: readonly { key: FlagKey; label: string; hint: string }[] = [
  { key: 'noCache', label: 'no-cache', hint: '저장은 하되, 쓰기 전에 원 서버에 확인해요.' },
  { key: 'noStore', label: 'no-store', hint: '어떤 캐시에도 저장하지 않아요.' },
  { key: 'private', label: 'private', hint: '공유 캐시는 저장하지 않고 개인 캐시에만 남겨요.' },
  { key: 'public', label: 'public', hint: '공유 캐시가 저장해도 된다고 명시해요.' },
  { key: 'mustRevalidate', label: 'must-revalidate', hint: '만료되면 옛 값을 주지 않고 반드시 확인해요.' },
  { key: 'etag', label: 'ETag 있음', hint: '응답 버전을 나타내는 값이에요. 재검증에 써요.' },
  { key: 'lastModified', label: 'Last-Modified 있음', hint: '마지막 수정 시각이에요. 재검증과 휴리스틱에 써요.' },
  { key: 'varyLanguage', label: 'Vary: Accept-Language', hint: '언어별로 저장본을 나눠요.' },
];

const MAX_AGE_OPTIONS = [
  { value: 'none', label: 'max-age 없음' },
  { value: '0', label: 'max-age=0' },
  { value: '60', label: 'max-age=60' },
  { value: '300', label: 'max-age=300' },
  { value: '3600', label: 'max-age=3600' },
] as const;

const S_MAXAGE_OPTIONS = [
  { value: 'none', label: 's-maxage 없음' },
  { value: '0', label: 's-maxage=0' },
  { value: '300', label: 's-maxage=300' },
] as const;

const SWR_OPTIONS = [
  { value: 'none', label: 'stale-while-revalidate 없음' },
  { value: '300', label: 'stale-while-revalidate=300' },
] as const;

const AGE_OPTIONS = [
  { value: '0', label: '0초 전' },
  { value: '30', label: '30초 전' },
  { value: '300', label: '5분 전' },
  { value: '3600', label: '1시간 전' },
  { value: '86400', label: '1일 전' },
] as const;

const ACTION_LABEL: Record<Verdict['action'], string> = {
  fresh: '신선 사용 · 네트워크 요청 없음',
  stale: '옛 값 즉시 응답 · 뒤에서 재검증',
  'not-modified': '재검증 304 · 저장본 재사용',
  changed: '재검증 200 · 새 본문 받음',
  origin: '원 서버 요청 · 저장본 안 씀',
};

const LAYER_LABEL: Record<CacheKind, string> = {
  browser: '개인 캐시 (브라우저)',
  shared: '공유 캐시 (CDN · 프록시)',
};

const optionValue = (n: number | null) => (n === null ? 'none' : String(n));
const parseNumber = (v: string) => (v === 'none' ? null : Number(v));

export default function Simulator() {
  const [headers, setHeaders] = useState<ResponseHeaders>(PRESETS[1].headers);
  const [presetId, setPresetId] = useState(PRESETS[1].id);
  const [ageSec, setAgeSec] = useState(300);
  const [authorized, setAuthorized] = useState(false);
  const [languageChanged, setLanguageChanged] = useState(false);
  const [originChanged, setOriginChanged] = useState(false);

  const changeHeaders = (patch: Partial<ResponseHeaders>) => {
    setPresetId('');
    setHeaders((prev) => ({ ...prev, ...patch }));
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setHeaders(preset.headers);
  };

  const setFlag = (key: FlagKey, on: boolean) => changeHeaders({ [key]: on } as Pick<ResponseHeaders, FlagKey>);

  const verdicts = useMemo(
    () => judgeBoth({ headers, ageSec, authorized, languageChanged, originChanged }),
    [headers, ageSec, authorized, languageChanged, originChanged],
  );

  const preset = PRESETS.find((p) => p.id === presetId);

  return (
    <div className="hc-lab">
      <RadioGroup
        label="예시 응답 고르기"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />
      {preset && <p className="hc-lab__hint">{preset.summary}</p>}

      <div className="hc-lab__controls">
        <RadioGroup
          label="max-age"
          options={MAX_AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={optionValue(headers.maxAge)}
          onValueChange={(v) => changeHeaders({ maxAge: parseNumber(v) })}
        />
        <RadioGroup
          label="s-maxage (공유 캐시만 봐요)"
          options={S_MAXAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={optionValue(headers.sMaxAge)}
          onValueChange={(v) => changeHeaders({ sMaxAge: parseNumber(v) })}
        />
        <RadioGroup
          label="stale-while-revalidate"
          options={SWR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={optionValue(headers.staleWhileRevalidate)}
          onValueChange={(v) => changeHeaders({ staleWhileRevalidate: parseNumber(v) })}
        />
      </div>

      <div className="hc-lab__flags">
        {FLAGS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            hint={f.hint}
            checked={headers[f.key]}
            onCheckedChange={(checked) => setFlag(f.key, checked === true)}
          />
        ))}
      </div>

      <div className="hc-lab__controls">
        <RadioGroup
          label="저장본을 받은 뒤 지난 시간"
          options={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={String(ageSec)}
          onValueChange={(v) => setAgeSec(Number(v))}
        />
      </div>

      <div className="hc-lab__flags">
        <Checkbox
          label="요청에 Authorization 헤더가 있어요"
          hint="로그인한 사용자의 요청이에요."
          checked={authorized}
          onCheckedChange={(checked) => setAuthorized(checked === true)}
        />
        <Checkbox
          label="이번 요청의 Accept-Language 가 저장본과 달라요"
          hint="Vary 가 있을 때만 결과에 영향을 줘요."
          checked={languageChanged}
          onCheckedChange={(checked) => setLanguageChanged(checked === true)}
        />
        <Checkbox
          label="원 서버 본문이 그 사이 바뀌었어요"
          hint="배포로 값이 바뀐 경우를 가정해요."
          checked={originChanged}
          onCheckedChange={(checked) => setOriginChanged(checked === true)}
        />
      </div>

      <p className="hc-lab__hint">
        신선 기간과 나이는 감을 잡기 위한 예시예요. 휴리스틱은 Last-Modified 가 30일 전이라고 가정했어요.
      </p>

      <section className="hc-lab__results" aria-label="결과">
        {(['browser', 'shared'] as const).map((kind) => {
          const v = verdicts[kind];
          return (
            <article key={kind} className="hc-card" data-layer={kind}>
              <h3 className="hc-card__layer">{LAYER_LABEL[kind]}</h3>
              <p className="hc-card__action" data-action={v.action}>
                {ACTION_LABEL[v.action]}
              </p>
              <p className="hc-card__meta">
                {v.lifetimeSec > 0
                  ? `${v.source === 'heuristic' ? '추정 신선 기간' : '신선 기간'} ${formatSec(v.lifetimeSec)}`
                  : '신선 기간 없음'}
              </p>
              <p className="hc-card__reason">{v.reason}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
