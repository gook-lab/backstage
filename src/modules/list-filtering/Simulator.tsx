import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  COUNT_LABEL,
  COUNT_MODES,
  type CountMode,
  countWork,
  facetWork,
  INDEX_LABEL,
  INDEXES,
  type IndexDef,
  LIMIT,
  PERIOD_LABEL,
  PERIODS,
  type Period,
  plan,
  type Sort,
  SORT_LABEL,
  SORTS,
  STATUS_LABEL,
  STATUSES,
  type Status,
  TOTAL_ROWS,
} from './model';
import './Simulator.css';

const INDEX_HINT: Record<IndexDef, string> = {
  none: '인덱스가 없으면 정렬도 찾기도 전체 행을 읽어요.',
  created: '최신순을 인덱스가 대신해요. 상태 조건은 테이블에서 하나씩 확인해요.',
  'status-created': '상태 등호 뒤에 created_at 이 와요. 상태가 고정돼야 정렬을 대신할 수 있어요.',
  'created-status': '상태를 인덱스 안에서 걸러요. 훑는 범위는 줄지 않고 테이블 방문만 줄어요.',
  'partial-pending': '결제 대기 행만 담아요. 쿼리가 같은 조건을 말할 때만 쓰여요.',
};

const COUNT_HINT: Record<CountMode, string> = {
  exact: '맞는 행을 전부 세요. 행이 많을수록 오래 걸려요.',
  cap: '1,001건까지만 세고 넘으면 상한을 보여 줘요.',
  'has-next': '다음 페이지 버튼을 켤지만 판단해요. 행 수는 몰라도 돼요.',
  estimate: '통계로 적은 값이에요. 실제 행 수와 차이가 날 수 있어요.',
};

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function Simulator() {
  const [status, setStatus] = useState<Status>('pending');
  const [period, setPeriod] = useState<Period>('7d');
  const [sort, setSort] = useState<Sort>('created');
  const [index, setIndex] = useState<IndexDef>('created');
  const [count, setCount] = useState<CountMode>('exact');

  const query = { status, period, sort, index };
  const p = plan(query);
  const c = countWork({ status, period }, count);
  const f = facetWork({ period, index });

  return (
    <div className="lf-lab">
      <p className="lf-lab__hint">
        주문 {fmt(TOTAL_ROWS)}건이 있다고 가정해요. 필터와 정렬을 고르고, 인덱스 열 순서를 바꿔 보세요. 수치는 모두
        예시예요.
      </p>

      <div className="lf-lab__controls">
        <RadioGroup
          label="상태 필터"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          value={status}
          onValueChange={setStatus}
        />
        <RadioGroup
          label="기간 필터"
          options={PERIODS.map((x) => ({ value: x, label: PERIOD_LABEL[x] }))}
          value={period}
          onValueChange={setPeriod}
        />
        <RadioGroup
          label="정렬"
          options={SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))}
          value={sort}
          onValueChange={setSort}
        />
      </div>

      <RadioGroup
        label="인덱스 정의 (열 순서)"
        options={INDEXES.map((x) => ({ value: x, label: INDEX_LABEL[x] }))}
        value={index}
        onValueChange={setIndex}
      />
      <p className="lf-lab__hint">{INDEX_HINT[index]}</p>

      <section className="lf-lab__results" aria-label="실행 계획">
        <Stat label="조건에 맞는 행 (예시)" value={fmt(p.matched)} unit="건" />
        <Stat label="인덱스 사용" value={p.usesIndex ? '사용' : '안 씀'} tone={p.usesIndex ? 'ink' : 'accent'} />
        <Stat label="훑은 인덱스 항목" value={fmt(p.indexEntries)} unit="개" />
        <Stat label="테이블 행 방문" value={fmt(p.tableRows)} unit="행" />
      </section>

      <p className="lf-lab__access">
        <strong>접근 방식</strong> {p.access}
      </p>
      <p className="lf-lab__sort" role="status">
        {p.sortNeeded ? (
          <>
            <Tag variant="accent">정렬 단계 있음</Tag> {fmt(p.sortRows)}행을 정렬해야 해요.
          </>
        ) : (
          <>
            <Tag>정렬 단계 없음</Tag> 인덱스 순서대로 {LIMIT}건을 바로 가져와요.
          </>
        )}
      </p>

      <section className="lf-lab__count" aria-label="개수 표시">
        <h3 className="lf-lab__title">전체 개수 표시 방식</h3>
        <RadioGroup
          label="개수 방식"
          options={COUNT_MODES.map((m) => ({ value: m, label: COUNT_LABEL[m] }))}
          value={count}
          onValueChange={setCount}
        />
        <p className="lf-lab__hint">{COUNT_HINT[count]}</p>
        <dl className="lf-lab__now">
          <div>
            <dt>화면 표시</dt>
            <dd>{c.shown}</dd>
          </div>
          <div>
            <dt>세려고 읽는 행</dt>
            <dd>{fmt(c.rowsRead)}행</dd>
          </div>
        </dl>
      </section>

      <section className="lf-lab__count" aria-label="facet 개수 비용">
        <h3 className="lf-lab__title">상태별 개수 (facet) 비용</h3>
        <table className="lf-table">
          <caption>상태 값 3개의 개수를 한 화면에 보여 줄 때</caption>
          <thead>
            <tr>
              <th scope="col">방식</th>
              <th scope="col">쿼리 수</th>
              <th scope="col">읽는 행</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>값마다 COUNT</td>
              <td>{f.perValue.queries}</td>
              <td>{fmt(f.perValue.rowsRead)}</td>
            </tr>
            <tr>
              <td>GROUP BY 한 번</td>
              <td>{f.grouped.queries}</td>
              <td>{fmt(f.grouped.rowsRead)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="lf-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
