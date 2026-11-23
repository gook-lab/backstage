import { Checkbox, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  CACHE_HEADERS,
  CACHE_LABEL,
  type CacheHeader,
  codeLength,
  codeSpace,
  collisionProbability,
  guessOutcome,
  HEURISTIC_CACHEABLE,
  KEEPS_METHOD,
  METHOD_HINT,
  METHOD_LABEL,
  METHODS,
  type CodeMethod,
  PERMANENT,
  type RedirectStatus,
  STATUS_LABEL,
  STATUSES,
  staleAfterChange,
} from './model';
import './Simulator.css';

const LINK_COUNTS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000] as const;
const GUESS_COUNTS = [100, 1_000, 10_000, 100_000, 1_000_000] as const;

const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact' });

function formatCount(n: number): string {
  return n >= 10_000 ? compact.format(n) : n.toLocaleString('ko-KR');
}

function formatPercent(p: number): string {
  if (p === 0) return '0%';
  if (p < 0.0001) return '0.01% 미만';
  return `${(p * 100).toFixed(p < 0.01 ? 4 : 1)}%`;
}

function formatHits(x: number): string {
  return x < 10 ? x.toFixed(2) : Math.round(x).toLocaleString('ko-KR');
}

function reasonText(status: RedirectStatus, cache: CacheHeader): string {
  if (cache === 'no-store') return 'no-store 는 저장하지 않아서 다음 방문에 새 주소를 받아요.';
  if (cache === 'max-age') return 'max-age 기간 동안 응답을 저장해요. 기간이 지나야 새 주소를 받아요.';
  if (HEURISTIC_CACHEABLE[status]) {
    return '이 응답은 헤더가 없어도 캐시할 수 있는 상태 코드예요. 저장 기간은 브라우저 구현에 따라 달라요.';
  }
  return '이 응답은 헤더가 없으면 저장하지 않아요. 다음 방문에 새 주소를 받아요.';
}

export default function Simulator() {
  const tableId = useId();
  const [method, setMethod] = useState<CodeMethod>('rand6');
  const [linkIdx, setLinkIdx] = useState(3);
  const [guessIdx, setGuessIdx] = useState(2);
  const [status, setStatus] = useState<RedirectStatus>(301);
  const [changed, setChanged] = useState(true);
  const [cache, setCache] = useState<CacheHeader>('none');

  const links = LINK_COUNTS[linkIdx];
  const guesses = GUESS_COUNTS[guessIdx];

  const length = codeLength(method, links);
  const space = codeSpace(length);
  const collision = collisionProbability(method, links);
  const guess = guessOutcome(method, links, guesses);

  const stale = changed && staleAfterChange(status, cache);

  return (
    <div className="sl-lab">
      <RadioGroup
        label="코드 만들기 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="sl-lab__hint">{METHOD_HINT[method]}</p>

      <div className="sl-lab__controls">
        <label className="sl-field">
          <span>링크 {formatCount(links)}개</span>
          <input
            type="range"
            min={0}
            max={LINK_COUNTS.length - 1}
            step={1}
            value={linkIdx}
            onChange={(e) => setLinkIdx(Number(e.target.value))}
          />
        </label>
        <label className="sl-field">
          <span>추측 {formatCount(guesses)}번</span>
          <input
            type="range"
            min={0}
            max={GUESS_COUNTS.length - 1}
            step={1}
            value={guessIdx}
            onChange={(e) => setGuessIdx(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="sl-lab__results" aria-label="코드 결과">
        <Stat label="코드 길이" value={`${length}자`} />
        <Stat label="가능한 코드 수" value={compact.format(space)} unit="개" />
        <Stat label="같은 코드가 생길 확률" value={formatPercent(collision)} />
        <Stat label="추측 한 번에 맞힐 확률" value={formatPercent(guess.hitRate)} />
        <Stat label={`추측 ${formatCount(guesses)}번 뒤 찾은 링크`} value={formatHits(guess.expectedHits)} unit="개" />
        <Stat
          label={`추측 ${formatCount(guesses)}번 중 한 번이라도 맞힐 확률`}
          value={formatPercent(guess.probAtLeastOne)}
        />
      </section>
      <p className="sl-lab__note">
        {method === 'seq'
          ? '순번은 충돌이 없지만, 0 부터 나열하면 찾은 링크 수가 추측 횟수와 같아져요.'
          : '무작위는 충돌을 저장 시점에 확인해 다시 뽑아요. 나열은 도움이 되지 않아요.'}
      </p>

      <div className="sl-lab__redirect">
        <RadioGroup
          label="리다이렉트 상태 코드"
          options={STATUSES.map((s) => ({ value: String(s), label: STATUS_LABEL[s] }))}
          value={String(status)}
          onValueChange={(v) => setStatus(Number(v) as RedirectStatus)}
        />
        <RadioGroup
          label="리다이렉트 응답의 Cache-Control"
          options={CACHE_HEADERS.map((c) => ({ value: c, label: CACHE_LABEL[c] }))}
          value={cache}
          onValueChange={setCache}
        />
        <Checkbox
          label="대상 URL을 바꿨어요"
          hint="바꾸지 않으면 옛 주소와 새 주소가 같아서 문제가 없어요."
          checked={changed}
          onCheckedChange={(checked) => setChanged(checked === true)}
        />
      </div>

      <section className="sl-lab__stale" aria-label="재방문 결과">
        {changed ? (
          <p className="sl-lab__verdict" role="status">
            {stale ? '변경 뒤 재방문자는 옛 주소로 갈 수 있어요.' : '변경 뒤 재방문자는 새 주소로 가요.'}
          </p>
        ) : (
          <p className="sl-lab__verdict" role="status">
            대상이 같아서 옛 주소 문제가 없어요.
          </p>
        )}
        <p className="sl-lab__note">{changed ? reasonText(status, cache) : ''}</p>
      </section>

      <table className="sl-table" aria-labelledby={`${tableId}-cap`}>
        <caption id={`${tableId}-cap`}>상태 코드별 차이 (헤더 없음 기준)</caption>
        <thead>
          <tr>
            <th scope="col">상태 코드</th>
            <th scope="col">영구 여부</th>
            <th scope="col">POST 메서드 유지</th>
            <th scope="col">헤더 없을 때 캐시</th>
          </tr>
        </thead>
        <tbody>
          {STATUSES.map((s) => (
            <tr key={s} data-current={s === status ? 'true' : undefined}>
              <th scope="row">{s}</th>
              <td>{PERMANENT[s] ? '영구' : '임시'}</td>
              <td>{KEEPS_METHOD[s] ? '유지' : '바뀔 수 있음'}</td>
              <td>{HEURISTIC_CACHEABLE[s] ? '가능' : '기본 아님'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sl-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
