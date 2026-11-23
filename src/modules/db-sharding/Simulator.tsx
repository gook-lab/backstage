import { RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import { moduleById } from '..';
import {
  DATE_WINDOW,
  MAX_PAGE,
  MAX_SHARDS,
  METHODS,
  type Method,
  movedRatio,
  ORDERS,
  PAGE_SIZE,
  type Query,
  QUERIES,
  RESHARD_KEYS,
  simulate,
} from './model';
import './Simulator.css';

const RELATED = ['replication-lag', 'multi-tenancy', 'distributed-ids', 'saga-compensation', 'search-index-sync'];

export default function Simulator() {
  const [method, setMethod] = useState<Method>('range');
  const [query, setQuery] = useState<Query>('latest');
  const [shards, setShards] = useState(4);
  const [page, setPage] = useState(1);
  const [recentPct, setRecentPct] = useState(0);

  const result = simulate({ shards, method, query, page, recentPct, seed: 7 });
  const reshard = useMemo(() => {
    const to = shards + 1;
    return {
      modulo: movedRatio('modulo', shards, to, RESHARD_KEYS).ratio,
      ring: movedRatio('ring', shards, to, RESHARD_KEYS).ratio,
    };
  }, [shards]);

  const methodInfo = METHODS.find((m) => m.id === method);
  const queryInfo = QUERIES.find((q) => q.id === query);
  const maxRows = Math.max(...result.shardRows);
  const verdict = result.targeted
    ? `샤드 키 조건이 있어 ${result.touched.length}개 샤드에서 끝나요`
    : `샤드 키 조건이 없어 ${shards}개 샤드 모두에 물어요`;

  return (
    <div className="sh-lab">
      <RadioGroup
        label="분할 방식"
        options={METHODS.map((m) => ({ value: m.id, label: m.label }))}
        value={method}
        onValueChange={(v) => setMethod(v as Method)}
      />
      <p className="sh-lab__hint">{methodInfo?.summary}</p>

      <RadioGroup
        label="조회 종류"
        options={QUERIES.map((q) => ({ value: q.id, label: q.label }))}
        value={query}
        onValueChange={(v) => setQuery(v as Query)}
      />
      <p className="sh-lab__hint">{queryInfo?.summary}</p>

      <div className="sh-lab__controls">
        <label className="sh-lab__range">
          <span>
            샤드 수 <strong>{shards}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={MAX_SHARDS}
            step={1}
            value={shards}
            onChange={(e) => setShards(Number(e.target.value))}
          />
        </label>
        <label className="sh-lab__range">
          <span>
            최신순 페이지 <strong>{page}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={MAX_PAGE}
            step={1}
            value={page}
            disabled={query !== 'latest'}
            onChange={(e) => setPage(Number(e.target.value))}
          />
        </label>
        <label className="sh-lab__range">
          <span>
            최근 가입 회원 주문 비율 <strong>{recentPct}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={90}
            step={10}
            value={recentPct}
            onChange={(e) => setRecentPct(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="sh-lab__result" aria-label="조회 결과">
        <p className="sh-lab__verdict" data-targeted={result.targeted}>
          {verdict}
        </p>
        <dl className="sh-lab__stats">
          <div>
            <dt>조회한 샤드</dt>
            <dd>{result.touched.length}개</dd>
          </div>
          <div>
            <dt>합칠 행</dt>
            <dd>{result.merged}건</dd>
          </div>
          <div>
            <dt>화면에 보여 주는 행</dt>
            <dd>{result.returned}건</dd>
          </div>
          <div>
            <dt>쏠림 (최대 ÷ 평균)</dt>
            <dd>{result.skew.toFixed(1)}배</dd>
          </div>
        </dl>

        <div className="sh-lab__shards">
          <h3>샤드별 주문 수 (예시)</h3>
          <ul>
            {result.shardRows.map((rows, i) => (
              <li key={i} data-hot={i === result.hotShard && result.skew > 1.2}>
                <span className="sh-lab__shard-name">샤드 {i + 1}</span>
                <span className="sh-lab__bar" aria-hidden="true">
                  <span style={{ width: `${(rows / maxRows) * 100}%` }} />
                </span>
                <span className="sh-lab__count">{rows}건</span>
              </li>
            ))}
          </ul>
          <p className="sh-lab__hint">
            전체 {ORDERS}건 기준이에요. 최신순 목록은 샤드마다 페이지 번호 × {PAGE_SIZE}건을 올려 보내요. 날짜 범위는
            최근 {Math.round(DATE_WINDOW * 100)}% 주문을 찾아요.
          </p>
        </div>

        <div className="sh-lab__reshard">
          <h3>
            샤드 {shards} → {shards + 1} 로 늘릴 때 옮기는 키 (예시)
          </h3>
          <dl className="sh-lab__stats">
            <div>
              <dt>나머지 방식 (키 % 샤드 수)</dt>
              <dd>{Math.round(reshard.modulo * 100)}%</dd>
            </div>
            <div>
              <dt>일관 해싱</dt>
              <dd>{Math.round(reshard.ring * 100)}%</dd>
            </div>
          </dl>
        </div>

        <div className="sh-lab__links-block">
          <h3>이어서 읽을 글</h3>
          <ul className="sh-lab__links">
            {RELATED.map((id) => (
              <li key={id}>
                <a href={`/m/${id}`}>{moduleById(id)?.title ?? id}</a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="sh-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
