import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  ALL_WIDTHS,
  DEVICES,
  type Format,
  ORIGINAL_BYTES,
  ORIGINAL_WIDTH,
  POLICIES,
  type KeyPolicy,
  type Slot,
  choose,
  purgeTargets,
  runAll,
  sizesText,
  srcsetText,
} from './model';
import './Simulator.css';

const SEED = 7;

const SLOT_OPTIONS: readonly { value: Slot; label: string }[] = [
  { value: 'full', label: '화면 전체 · 100vw' },
  { value: 'half', label: '절반 · 50vw' },
  { value: 'fixed', label: '고정 320px' },
];

const FORMAT_OPTIONS: readonly { value: Format; label: string; hint: string }[] = [
  { value: 'avif', label: 'AVIF', hint: '가장 작지만 오래된 브라우저에는 없어요. JPEG 로 대신 줘요.' },
  { value: 'webp', label: 'WebP', hint: 'AVIF 보다 큰 대신 지원 범위가 넓어요.' },
];

const kb = (bytes: number) => `${Math.round(bytes / 1000).toLocaleString('ko-KR')}KB`;

export default function Simulator() {
  const [deviceId, setDeviceId] = useState(DEVICES[0].id);
  const [slot, setSlot] = useState<Slot>('full');
  const [widths, setWidths] = useState<number[]>([...ALL_WIDTHS]);
  const [formats, setFormats] = useState<Format[]>(['avif', 'webp']);
  const [policy, setPolicy] = useState<KeyPolicy>('width-format');
  const [hashed, setHashed] = useState(true);

  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const choice = choose(device, slot, widths, formats);
  const ratio = Math.round((choice.bytes / ORIGINAL_BYTES) * 100);

  const results = useMemo(() => runAll(SEED, slot, widths, formats), [slot, widths, formats]);
  const purge = purgeTargets(widths, formats, hashed);

  const toggleWidth = (w: number, on: boolean) =>
    setWidths((prev) => (on ? [...prev, w].sort((a, b) => a - b) : prev.filter((x) => x !== w)));
  const toggleFormat = (f: Format, on: boolean) =>
    setFormats((prev) => (on ? [...prev, f] : prev.filter((x) => x !== f)));

  return (
    <div className="ic-lab">
      <RadioGroup
        label="어떤 기기인가요?"
        options={DEVICES.map((d) => ({ value: d.id, label: d.label }))}
        value={deviceId}
        onValueChange={setDeviceId}
      />

      <div className="ic-lab__row">
        <RadioGroup
          label="이미지가 화면에서 차지하는 너비 (sizes)"
          options={SLOT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={slot}
          onValueChange={(v) => setSlot(v)}
        />

        <fieldset className="ic-lab__fieldset">
          <legend>만들어 둔 변형 너비</legend>
          {ALL_WIDTHS.map((w) => (
            <Checkbox
              key={w}
              label={`${w}px`}
              checked={widths.includes(w)}
              onCheckedChange={(checked) => toggleWidth(w, checked === true)}
            />
          ))}
        </fieldset>

        <fieldset className="ic-lab__fieldset">
          <legend>만들어 둔 형식 (JPEG 은 항상 있어요)</legend>
          {FORMAT_OPTIONS.map((f) => (
            <Checkbox
              key={f.value}
              label={f.label}
              hint={f.hint}
              checked={formats.includes(f.value)}
              onCheckedChange={(checked) => toggleFormat(f.value, checked === true)}
            />
          ))}
        </fieldset>
      </div>

      <section className="ic-lab__result" aria-label="브라우저 선택">
        <p className="ic-lab__verdict">
          이 기기는 <strong>{choice.width}w</strong> · <strong>{choice.format.toUpperCase()}</strong> 파일을 받아요
        </p>
        <p className="ic-lab__hint">
          {choice.width === ORIGINAL_WIDTH
            ? '만들어 둔 변형이 모두 작아서 원본을 받아요. 원본을 줄이는 것과 같아요.'
            : `원본 ${kb(ORIGINAL_BYTES)} 대신 ${kb(choice.bytes)} 를 받아요. 원본의 ${ratio}% 예요.`}
        </p>
        <dl className="ic-lab__code">
          <dt>srcset</dt>
          <dd>
            <code>{srcsetText(widths)}</code>
          </dd>
          <dt>sizes</dt>
          <dd>
            <code>{sizesText(slot)}</code>
          </dd>
        </dl>
        <p className="ic-lab__hint">
          브라우저는 슬롯 너비 × DPR 로 이상적인 픽셀 너비를 정하고, 같은 값이 없으면 그보다 큰 첫 후보를 골라요. 형식은
          srcset 이 아니라 서버가 Accept 로 협상해요.
        </p>
      </section>

      <section className="ic-lab__result" aria-label="캐시 키">
        <RadioGroup
          label="캐시 키에 무엇을 넣을까요?"
          options={POLICIES.map((p) => ({ value: p.value, label: p.label }))}
          value={policy}
          onValueChange={setPolicy}
        />
        <p className="ic-lab__hint">{POLICIES.find((p) => p.value === policy)?.hint}</p>

        <div className="ic-lab__table-wrap">
          <table className="ic-lab__table">
            <caption>요청 {results[0].requests.toLocaleString('ko-KR')}건 · 같은 순서 · 캐시 한 계층</caption>
            <thead>
              <tr>
                <th scope="col">캐시 키</th>
                <th scope="col">적중률</th>
                <th scope="col">원본 요청</th>
                <th scope="col">잘못된 응답</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.policy} data-selected={r.policy === policy ? 'true' : undefined}>
                  <th scope="row">{POLICIES.find((p) => p.value === r.policy)?.label}</th>
                  <td>{Math.round(r.hitRatio * 100)}%</td>
                  <td>{r.originRequests.toLocaleString('ko-KR')}</td>
                  <td data-wrong={r.wrong > 0 ? 'true' : undefined}>{r.wrong.toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ic-lab__hint">
          적중률이 높아도 잘못된 응답이 있으면 쓸 수 없어요. 잘못된 응답은 다른 크기나 형식을 돌려준 횟수예요.
        </p>
      </section>

      <section className="ic-lab__result" aria-label="무효화">
        <Checkbox
          label="파일 이름에 내용 해시를 넣기"
          hint="내용이 바뀌면 이름도 바뀌어서 새 URL 을 받아요. 그래서 기존 URL 을 지울 필요가 없어요."
          checked={hashed}
          onCheckedChange={(checked) => setHashed(checked === true)}
        />
        <p className="ic-lab__verdict">이미지 한 장을 바꿀 때 무효화할 URL {purge.toLocaleString('ko-KR')}개</p>
      </section>
    </div>
  );
}
