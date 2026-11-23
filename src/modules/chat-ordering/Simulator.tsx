import { Button, Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { type Config, DEFAULT_CONFIG, LABEL, type ReadSync, type SortBy, type Stored, simulate } from './model';
import './Simulator.css';

const SORT_OPTIONS: { value: SortBy; label: string; hint: string }[] = [
  { value: 'client', label: '보낸 기기 시각', hint: '각 기기의 시계로 찍은 시각을 기준으로 정렬해요.' },
  {
    value: 'arrival',
    label: '서버 수신 시각',
    hint: '서버가 받은 시각을 초 단위로 기록하고, 같은 초는 id 순으로 정렬해요.',
  },
  {
    value: 'received',
    label: '기기가 받은 순서',
    hint: '각 기기가 메시지를 받은 순서대로 쌓아요. 기준으로 쓰면 안 되는 예시예요.',
  },
  { value: 'seq', label: '서버 순번', hint: '서버가 방마다 도착 순서대로 붙인 번호로 정렬해요.' },
];

const READ_OPTIONS: { value: ReadSync; label: string }[] = [
  { value: 'server', label: '서버에 저장' },
  { value: 'local', label: '기기 안에만 저장' },
];

const SKEW_MIN = -60;
const SKEW_MAX = 60;

function Cell({ r }: { r: Stored }) {
  return (
    <span className="cho-cell">
      {LABEL[r.id]} <span className="cho-cell__seq">#{r.seq}</span>
      {r.dup && <span className="cho-cell__dup"> 중복</span>}
    </span>
  );
}

export default function Simulator() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const patch = (next: Partial<Config>) => setConfig((c) => ({ ...c, ...next }));

  const result = useMemo(() => simulate(config), [config]);
  const phone = result.views.find((v) => v.viewer === 'phone')!;
  const laptop = result.views.find((v) => v.viewer === 'laptop')!;
  const peer = result.views.find((v) => v.viewer === 'peer')!;
  const columns = [phone, laptop, peer];
  const height = Math.max(...columns.map((v) => v.rows.length));

  return (
    <div className="cho-lab">
      <RadioGroup
        label="정렬 기준"
        options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={config.sortBy}
        onValueChange={(value) => patch({ sortBy: value as SortBy })}
      />
      <p className="cho-lab__hint">{SORT_OPTIONS.find((o) => o.value === config.sortBy)?.hint}</p>

      <div className="cho-lab__controls">
        <label className="cho-field">
          <span>
            나 폰 시계 오차 <strong>{config.meSkew}초</strong>
          </span>
          <input
            type="range"
            min={SKEW_MIN}
            max={SKEW_MAX}
            step={1}
            value={config.meSkew}
            onChange={(e) => patch({ meSkew: Number(e.target.value) })}
          />
        </label>
        <label className="cho-field">
          <span>
            상대 폰 시계 오차 <strong>{config.peerSkew}초</strong>
          </span>
          <input
            type="range"
            min={SKEW_MIN}
            max={SKEW_MAX}
            step={1}
            value={config.peerSkew}
            onChange={(e) => patch({ peerSkew: Number(e.target.value) })}
          />
        </label>
        <label className="cho-field">
          <span>
            나 폰 → 서버 지연 <strong>{config.meDelay}ms</strong>
          </span>
          <input
            type="range"
            min={0}
            max={3000}
            step={100}
            value={config.meDelay}
            onChange={(e) => patch({ meDelay: Number(e.target.value) })}
          />
        </label>
        <label className="cho-field">
          <span>
            상대 폰 → 서버 지연 <strong>{config.peerDelay}ms</strong>
          </span>
          <input
            type="range"
            min={0}
            max={3000}
            step={100}
            value={config.peerDelay}
            onChange={(e) => patch({ peerDelay: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="cho-lab__toggles">
        <Checkbox
          label="노트북 연결 끊김 (2.5초~4초)"
          hint="이 구간에 도착한 메시지는 노트북이 실시간으로 받지 못해요."
          checked={config.offline}
          onCheckedChange={(checked) => patch({ offline: checked === true })}
        />
        <Checkbox
          label="재연결 뒤 마지막 순번 이후 요청"
          hint="끊기기 전에 받은 마지막 순번 뒤를 서버에 요청해요."
          checked={config.fill}
          onCheckedChange={(checked) => patch({ fill: checked === true })}
        />
        <Checkbox
          label="나 폰이 ACK 를 못 받고 재전송 (내 2)"
          hint="서버에는 이미 저장됐지만 응답을 받지 못한 상황이에요."
          checked={config.retry}
          onCheckedChange={(checked) => patch({ retry: checked === true })}
        />
        <Checkbox
          label="서버가 클라이언트 메시지 id 로 중복 거르기"
          hint="같은 id 가 다시 오면 처음 받은 순번을 돌려줘요."
          checked={config.dedupe}
          onCheckedChange={(checked) => patch({ dedupe: checked === true })}
        />
      </div>

      <RadioGroup
        label="읽음 위치 저장"
        options={READ_OPTIONS}
        value={config.readSync}
        onValueChange={(value) => patch({ readSync: value as ReadSync })}
      />

      <div className="cho-lab__stats">
        <Stat label="나 폰 안 읽은 수" value={phone.unread ?? 0} />
        <Stat label="노트북 안 읽은 수" value={laptop.unread ?? 0} />
        <Stat label="노트북에 빠진 메시지" value={laptop.missing.length} />
        <Stat label="중복 저장" value={result.duplicates} />
      </div>

      <section aria-labelledby="cho-view-title" className="cho-lab__views">
        <h3 id="cho-view-title">기기별 화면 순서</h3>
        <table className="cho-table">
          <caption>번호는 서버가 붙인 순번이에요. 내 · 상대 번호는 보낸 순서예요.</caption>
          <thead>
            <tr>
              <th scope="col">위치</th>
              {columns.map((v) => (
                <th key={v.viewer} scope="col">
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: height }, (_, i) => (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                {columns.map((v) => (
                  <td key={v.viewer}>{v.rows[i] ? <Cell r={v.rows[i]} /> : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {laptop.missing.length > 0 && (
          <p className="cho-lab__note">
            노트북 화면에는 {laptop.missing.map((id) => LABEL[id]).join(', ')} 메시지가 없어요.
          </p>
        )}
      </section>

      <section aria-labelledby="cho-moved-title" className="cho-lab__moved">
        <h3 id="cho-moved-title">내 메시지의 자리 변화</h3>
        <ul>
          {result.moved.map((m) => (
            <li key={m.id}>
              {LABEL[m.id]}: 전송 직후 {m.provisional}번째 → 새로고침 뒤 {m.final}번째
            </li>
          ))}
        </ul>
      </section>

      <div className="cho-lab__notes" role="status" aria-live="polite">
        <h3>결과 해석</h3>
        <ul>
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div className="cho-lab__actions">
        <Button variant="secondary" size="sm" onClick={() => setConfig(DEFAULT_CONFIG)}>
          처음 설정으로
        </Button>
      </div>
      <p className="cho-lab__footnote">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
