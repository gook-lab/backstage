import { RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  CORPUS,
  METHOD_LABEL,
  METHODS,
  type Method,
  PAGE_SIZE,
  type Params,
  paginate,
  suggestTerms,
  TIE_BREAKS,
  TIE_LABEL,
  type TieBreak,
  matchesOf,
  tieGroups,
} from './model';
import './Simulator.css';

const METHOD_HINT: Record<Method, string> = {
  count: '검색 단어가 제목에 몇 개 들어 있는지만 세요. 자주 나온 단어를 구분하지 못해요.',
  tfidf: '단어가 나온 횟수에 흔하지 않은 단어일수록 큰 가중치를 줘요. 나온 횟수가 늘면 그대로 늘어나요.',
  bm25: '같은 단어가 여러 번 나와도 점수가 조금씩만 늘어나고, 짧은 제목을 조금 더 높게 봐요.',
};

const TIE_HINT: Record<TieBreak, string> = {
  none: '점수가 같은 상품의 순서를 정하지 않아요. 요청마다 순서가 바뀔 수 있어요.',
  id: '점수가 같으면 id 로 정해요. 같은 요청은 언제나 같은 순서가 나와요.',
};

function toWeight(value: number): number {
  return value / 100;
}

export default function Simulator() {
  const captionId = useId();
  const [query, setQuery] = useState('사과 주스');
  const [method, setMethod] = useState<Method>('bm25');
  const [popPct, setPopPct] = useState(0);
  const [recencyPct, setRecencyPct] = useState(0);
  const [tieBreak, setTieBreak] = useState<TieBreak>('none');

  const typed = query.trim();
  const params: Params = {
    query: typed,
    method,
    popWeight: toWeight(popPct),
    recencyWeight: toWeight(recencyPct),
    tieBreak,
  };
  const hasQuery = typed.length > 0;
  const matched = hasQuery ? matchesOf(typed).length : 0;
  const pages = hasQuery ? paginate(params, 2, PAGE_SIZE) : null;
  const ties = hasQuery ? tieGroups(params) : 0;
  const titleOf = (id: string) => CORPUS.find((p) => p.id === id)?.title ?? id;
  const typoHints = hasQuery ? suggestTerms(typed) : [];

  let verdict: string;
  let correct = true;
  if (!hasQuery) {
    verdict = '검색어를 입력해 주세요.';
  } else if (matched === 0) {
    verdict = '결과가 0건이에요.';
  } else if (pages && (pages.duplicates > 0 || pages.missing > 0)) {
    correct = false;
    verdict = `2페이지까지 중복 ${pages.duplicates}건, 누락 ${pages.missing}건이 생겼어요. 점수가 같은 상품의 순서가 요청마다 달랐기 때문이에요.`;
  } else {
    verdict = '2페이지까지 중복과 누락이 없어요.';
  }

  return (
    <div className="sr-lab">
      <label className="sr-field">
        <span>검색어 (직접 바꿔 볼 수 있어요)</span>
        <input
          type="text"
          value={query}
          maxLength={20}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${captionId}-query`}
        />
        <small id={`${captionId}-query`}>단어는 공백으로 나눠요. 예: "사과 주스", "사과 쥬스" (오타 교정 확인용)</small>
      </label>

      <RadioGroup
        label="관련도 점수 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="sr-lab__hint">{METHOD_HINT[method]}</p>

      <div className="sr-lab__weights">
        <label className="sr-field">
          <span>판매 가중치 {popPct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={popPct}
            onChange={(e) => setPopPct(Number(e.target.value))}
          />
        </label>
        <label className="sr-field">
          <span>최신 가중치 {recencyPct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={recencyPct}
            onChange={(e) => setRecencyPct(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="sr-lab__note">
        최종 점수 = 관련도 × (1 + 판매 가중치 · 판매 비율 + 최신 가중치 · 최신 비율). 비율은 예시 데이터의 최댓값
        기준이에요.
      </p>

      <RadioGroup
        label="점수가 같을 때 순서 (동점 처리)"
        options={TIE_BREAKS.map((t) => ({ value: t, label: TIE_LABEL[t] }))}
        value={tieBreak}
        onValueChange={setTieBreak}
      />
      <p className="sr-lab__hint">{TIE_HINT[tieBreak]}</p>

      <section className="sr-lab__results" aria-label="결과">
        <Stat label="검색 결과 수" value={matched} unit="건" />
        <Stat label="점수가 같은 그룹" value={ties} unit="개" />
        <Stat
          label="2페이지까지 중복"
          value={pages?.duplicates ?? 0}
          unit="건"
          tone={(pages?.duplicates ?? 0) > 0 ? 'accent' : 'ink'}
        />
        <Stat
          label="2페이지까지 누락"
          value={pages?.missing ?? 0}
          unit="건"
          tone={(pages?.missing ?? 0) > 0 ? 'accent' : 'ink'}
        />
      </section>

      <p className="sr-lab__verdict" role="status" data-correct={correct ? 'yes' : 'no'}>
        {verdict}
      </p>
      {typoHints.map((h) => (
        <p key={h.from} className="sr-lab__note">
          "{h.from}" 은 "{h.to}" 의 오타일 수 있어요. 교정 후보는 사용자가 확인한 뒤에만 적용해요.
        </p>
      ))}

      {pages && matched > 0 && (
        <section className="sr-lab__pages" aria-labelledby={`${captionId}-pages`}>
          <h3 id={`${captionId}-pages`}>페이지별 결과 (한 페이지 {PAGE_SIZE}건)</h3>
          <div className="sr-lab__pagegrid">
            {pages.pages.map((ids, i) => (
              <table key={i} className="sr-lab__table">
                <caption>{i + 1} 페이지</caption>
                <thead>
                  <tr>
                    <th scope="col">순위</th>
                    <th scope="col">상품</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id, row) => {
                    const dup = pages.pages.flat().filter((x) => x === id).length > 1;
                    return (
                      <tr key={id} data-dup={dup ? 'yes' : 'no'}>
                        <td>{i * PAGE_SIZE + row + 1}</td>
                        <td>{titleOf(id)}</td>
                        <td>{dup ? '중복' : '한 번'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
          <p className="sr-lab__note">
            같은 상품이 두 페이지에 모두 나오면 중복이에요. 기준 순서(id 로 동점을 정한 결과)의 앞 8건 중 어느
            페이지에도 없으면 누락이에요.
          </p>
        </section>
      )}
    </div>
  );
}
