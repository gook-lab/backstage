import { Button, Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import { type IdScheme, SCHEME_HINT, SCHEME_LABEL, SCHEMES, generate } from './model';
import './Simulator.css';

const PREVIEW_ROWS = 8;

const pct = (x: number) => `${Math.round(x * 100)}%`;

const INSERT_LABELS = ['앞쪽 (0–25%)', '가운데 앞 (25–50%)', '가운데 뒤 (50–75%)', '뒤쪽 (75–100%)'] as const;

export default function Simulator() {
  const histId = useId();
  const [scheme, setScheme] = useState<IdScheme>('serial');
  const [count, setCount] = useState(40);
  const [rollbackPct, setRollbackPct] = useState(20);
  const [monotonic, setMonotonic] = useState(false);
  const [seed, setSeed] = useState(7);

  const isSerial = scheme === 'serial';
  const isV7 = scheme === 'uuid-v7';
  const isNumeric = scheme === 'serial' || scheme === 'int64';

  const result = generate({
    scheme,
    count,
    rollbackRate: isSerial ? rollbackPct / 100 : 0,
    monotonicV7: isV7 && monotonic,
    seed,
  });

  const preview = result.rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="di-lab">
      <RadioGroup
        label="ID 방식"
        options={SCHEMES.map((s) => ({ value: s, label: SCHEME_LABEL[s] }))}
        value={scheme}
        onValueChange={setScheme}
      />
      <p className="di-lab__hint">{SCHEME_HINT[scheme]}</p>

      <div className="di-lab__controls">
        <label className="di-field">
          <span>생성 개수 {count}개</span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label className="di-field">
          <span>롤백 비율 {isSerial ? `${rollbackPct}%` : '해당 없음'}</span>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={rollbackPct}
            disabled={!isSerial}
            onChange={(e) => setRollbackPct(Number(e.target.value))}
          />
          {!isSerial && <small>롤백은 자동 증가 번호를 되돌리지 않아 빈 번호를 만들어요.</small>}
        </label>
      </div>

      <Checkbox
        checked={isV7 && monotonic}
        disabled={!isV7}
        onCheckedChange={(v) => setMonotonic(v === true)}
        label="같은 밀리초 안에서 카운터 쓰기 (RFC 9562 §6.2)"
        hint={isV7 ? '끄면 같은 밀리초 안의 순서가 무작위로 섞여요.' : 'UUID v7 에서만 쓰는 옵션이에요.'}
      />

      <div className="di-lab__seed">
        <span>시드 {seed} · 같은 시드는 항상 같은 ID 목록이에요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="di-lab__results" aria-label="결과">
        <Stat label="생성 순서 = 정렬 순서 (인접 쌍)" value={pct(result.sortedMatch)} />
        <Stat label="이전 값 + 1 로 맞힌 비율" value={pct(result.guessHit)} />
        <Stat label="새 값이 항상 맨 뒤에 붙은 비율" value={pct(result.appendShare)} />
        {isNumeric ? (
          <Stat
            label="JS Number 로 읽으면 깨지는 ID"
            value={result.precisionLoss}
            unit="개"
            tone={result.precisionLoss > 0 ? 'accent' : 'ink'}
          />
        ) : (
          <Stat label="JS Number 로 읽으면 깨지는 ID" value="해당 없음" />
        )}
        {isSerial && <Stat label="돌아오지 않은 빈 번호" value={result.gaps} unit="개" />}
      </section>

      {result.precisionLoss > 0 && (
        <p className="di-lab__alarm" role="status">
          {result.precisionLoss}개 ID 가 2의 53제곱(9007199254740992)을 넘어요. JSON 숫자로 받으면 끝자리가 바뀔 수
          있어요. 문자열로 받으세요.
        </p>
      )}

      <section className="di-lab__hist" aria-labelledby={histId}>
        <h3 id={histId}>새 값이 들어간 자리 (기존 값 기준)</h3>
        <ul className="di-hist">
          {INSERT_LABELS.map((label, i) => (
            <li key={label} className="di-hist__row">
              <span className="di-hist__label">{label}</span>
              <span className="di-hist__track" aria-hidden="true">
                <span className="di-hist__bar" style={{ width: pct(result.insertShares[i]) }} />
              </span>
              <span className="di-hist__value">{pct(result.insertShares[i])}</span>
            </li>
          ))}
        </ul>
        <p className="di-lab__note">
          뒤쪽에만 몰리면 인덱스 끝에 붙어요. 앞쪽까지 고르게 흩어지면 기존 페이지 여러 곳에 쓰기가 생겨요.
        </p>
      </section>

      <table className="di-table">
        <caption>처음 {preview.length}개 ID — 생성 순서, 정렬 자리, JS 로 읽은 값</caption>
        <thead>
          <tr>
            <th scope="col">생성 순서</th>
            <th scope="col">ID</th>
            <th scope="col">정렬 자리</th>
            <th scope="col">JS 로 읽은 값</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((row) => {
            const jsValue = isNumeric ? String(Number(row.key)) : '문자열 그대로';
            const lost = isNumeric && jsValue !== row.key;
            return (
              <tr key={row.order}>
                <td>{row.order}</td>
                <td className="di-table__key">{row.key}</td>
                <td>{row.rank}</td>
                <td>
                  {jsValue} {lost && <Tag variant="accent">값이 바뀜</Tag>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
