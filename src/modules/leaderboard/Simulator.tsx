import { Button, RadioGroup, Stat } from '@gook-lab/ui';
import { useId, useMemo, useState } from 'react';
import {
  METHODS,
  METHOD_LABEL,
  MAX_SCORE,
  makePlayers,
  type Player,
  type RankMethod,
  rankOf,
  ranking,
  TIE_LABEL,
  TIE_RULES,
  type TieRule,
  tieGroup,
} from './model';
import './Simulator.css';

const SIZE_OPTIONS = [
  { value: '1000', label: '1천 명' },
  { value: '10000', label: '1만 명' },
  { value: '100000', label: '10만 명' },
];

const METHOD_HINT: Record<RankMethod, string> = {
  'db-count': '내 점수보다 앞선 행을 전부 세요. 참가자가 많아질수록 세는 행도 많아져요.',
  'sorted-set': '점수 순서를 이미 갖고 있어서 순위 조회가 로그 단계로 끝나요. 점수가 바뀔 때 순서도 함께 갱신해요.',
  bucket: '점수 구간마다 인원수만 들고 있어요. 같은 구간 안의 순서는 몰라서 순위를 범위로 보여 줘요.',
};

const TIE_HINT: Record<TieRule, string> = {
  'first-reached': '같은 점수면 먼저 도달한 사람이 위에 와요. 점수에 도달 순서를 섞어 하나의 값으로 만들어요.',
  member: '같은 점수면 이름 순서로 정해져요. 먼저 도달했는지는 순위에 반영되지 않아요.',
};

const ME_ID = 'user-me';

export default function Simulator() {
  const tableId = useId();
  const [sizeKey, setSizeKey] = useState('1000');
  const [method, setMethod] = useState<RankMethod>('db-count');
  const [tie, setTie] = useState<TieRule>('first-reached');
  const [myScore, setMyScore] = useState(640);
  const [arrivedFirst, setArrivedFirst] = useState(true);
  const [seed, setSeed] = useState(7);

  const size = Number(sizeKey);
  const { me, players } = useMemo(() => {
    const others = makePlayers(size, seed);
    const self: Player = { id: ME_ID, score: myScore, arrival: arrivedFirst ? 0 : size + 1 };
    return { me: self, players: [...others, self] };
  }, [size, seed, myScore, arrivedFirst]);

  const result = rankOf(players, me, method, tie);
  const rankText = result.exact ? `${result.low}위` : `${result.low}~${result.high}위`;
  const sameScore = tieGroup(players, me, tie);
  const topFive = useMemo(() => ranking(players, tie).slice(0, 5), [players, tie]);
  const nameOf = (p: Player) => (p.id === ME_ID ? '나' : p.id);
  const arrivalOf = (p: Player) => (p.id === ME_ID ? (arrivedFirst ? '먼저' : '나중') : `${p.arrival}번째`);

  return (
    <div className="lb-lab">
      <RadioGroup label="참가자 수" options={SIZE_OPTIONS} value={sizeKey} onValueChange={setSizeKey} />

      <RadioGroup
        label="순위 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="lb-lab__hint">{METHOD_HINT[method]}</p>

      <RadioGroup
        label="동점 규칙"
        options={TIE_RULES.map((t) => ({ value: t, label: TIE_LABEL[t] }))}
        value={tie}
        onValueChange={setTie}
      />
      <p className="lb-lab__hint">{TIE_HINT[tie]}</p>

      <div className="lb-lab__controls">
        <label className="lb-field">
          <span>
            내 점수 {myScore}점 (최대 {MAX_SCORE}점)
          </span>
          <input
            type="range"
            min={0}
            max={MAX_SCORE}
            step={1}
            value={myScore}
            onChange={(e) => setMyScore(Number(e.target.value))}
          />
        </label>
        <RadioGroup
          label="내가 도달한 순서"
          options={[
            { value: 'first', label: '먼저' },
            { value: 'last', label: '나중' },
          ]}
          value={arrivedFirst ? 'first' : 'last'}
          onValueChange={(v) => setArrivedFirst(v === 'first')}
        />
      </div>

      <div className="lb-lab__seed">
        <span>시드 {seed} · 같은 시드는 같은 참가자 모임을 만들어요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 모임으로 다시 돌리기
        </Button>
      </div>

      <section className="lb-lab__results" aria-label="결과">
        <Stat label="내 순위" value={rankText} />
        <Stat label="읽는 항목 수 (예시)" value={result.reads} unit="개" />
        <Stat label="같은 점수 참가자" value={sameScore.length - 1} unit="명" />
      </section>

      {!result.exact && (
        <p className="lb-lab__note" role="status">
          근사 구간이라 실제 순위는 {rankText} 안에 있어요. 구간 안의 순서는 이 방식으로 알 수 없어요.
        </p>
      )}

      <section className="lb-lab__table-wrap" aria-labelledby={`${tableId}-top`}>
        <h3 id={`${tableId}-top`}>상위 5명 (동점 규칙 적용)</h3>
        <table className="lb-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">참가자</th>
              <th scope="col">점수</th>
              <th scope="col">도달 순서</th>
            </tr>
          </thead>
          <tbody>
            {topFive.map((p, i) => (
              <tr key={p.id} className={p.id === ME_ID ? 'lb-table__me' : undefined}>
                <td>{i + 1}</td>
                <td>{nameOf(p)}</td>
                <td>{p.score}</td>
                <td>{arrivalOf(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="lb-lab__table-wrap" aria-labelledby={`${tableId}-tie`}>
        <h3 id={`${tableId}-tie`}>내 점수와 같은 점수의 줄 서기</h3>
        <table className="lb-table">
          <caption>
            {myScore}점 {sameScore.length}명 중 앞쪽 8명
          </caption>
          <thead>
            <tr>
              <th scope="col">자리</th>
              <th scope="col">참가자</th>
              <th scope="col">도달 순서</th>
            </tr>
          </thead>
          <tbody>
            {sameScore.slice(0, 8).map((p, i) => (
              <tr key={p.id} className={p.id === ME_ID ? 'lb-table__me' : undefined}>
                <td>{i + 1}</td>
                <td>{nameOf(p)}</td>
                <td>{arrivalOf(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="lb-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
