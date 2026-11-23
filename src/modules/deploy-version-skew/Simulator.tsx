import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import { brokenSteps, DEFAULT_OPTIONS, type Options, simulate, type Strategy, type ApiChange } from './model';
import './Simulator.css';

const STRATEGIES: readonly { value: Strategy; label: string; hint: string }[] = [
  { value: 'rolling', label: '롤링 배포', hint: '옛 서버와 새 서버를 한 칸씩 바꿔요.' },
  { value: 'blueGreen', label: '블루-그린', hint: '칸 2에서 라우터를 한 번에 바꿔요.' },
  { value: 'canary', label: '카나리 10%', hint: '칸 1~3에는 10%만 새 버전으로 보내요.' },
];

const STRATEGY_REASON: Record<Strategy, string> = {
  rolling: '같은 탭의 요청도 옛 서버와 새 서버에 나뉘어 가요. 그래서 응답 모양이 요청마다 달라 보여요.',
  blueGreen: '전환 뒤에는 옛 탭 요청도 전부 새 환경으로 가요. 옛 환경은 롤백용으로 남아 있어요.',
  canary: '일부 요청만 새 버전으로 가요. 비율을 올리는 동안만 깨짐이 적어요.',
};

const API_OPTIONS: readonly { value: ApiChange; label: string }[] = [
  { value: 'immediate', label: '필드를 바로 빼요' },
  { value: 'expandContract', label: '확장 후 축소해요' },
];

const API_REASON: Record<ApiChange, string> = {
  immediate: '새 서버 응답에 옛 필드가 없어요. 옛 탭은 그 값을 찾다가 빈 값을 받아요.',
  expandContract: '이번 배포는 새 필드를 더해요. 옛 필드를 빼는 축소는 옛 탭이 사라진 뒤 따로 해요.',
};

const ASSET_OPTIONS: readonly { value: 'keep' | 'drop'; label: string }[] = [
  { value: 'keep', label: '옛 해시 파일을 남겨요' },
  { value: 'drop', label: '새 배포에서 지워요' },
];

const ASSET_REASON = {
  keep: '옛 해시 파일이 남아 있어서 옛 탭의 청크 요청이 성공해요.',
  drop: '새 배포에 옛 해시 파일이 없어서 옛 탭의 청크 요청이 404가 돼요.',
} as const;

const pctText = (n: number) => `${n}%`;

export default function Simulator() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);

  const results = simulate(options);
  const broken = brokenSteps(results);

  const update = (patch: Partial<Options>) => setOptions((prev) => ({ ...prev, ...patch }));

  return (
    <div className="dvs-lab">
      <RadioGroup
        label="배포 방식"
        options={STRATEGIES.map((s) => ({ value: s.value, label: s.label }))}
        value={options.strategy}
        onValueChange={(v) => update({ strategy: v as Strategy })}
      />
      <p className="dvs-lab__hint">{STRATEGIES.find((s) => s.value === options.strategy)?.hint}</p>

      <RadioGroup
        label="옛 자산 보존"
        options={ASSET_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={options.keepAssets ? 'keep' : 'drop'}
        onValueChange={(v) => update({ keepAssets: v === 'keep' })}
      />

      <RadioGroup
        label="API 변경 방식"
        options={API_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={options.apiChange}
        onValueChange={(v) => update({ apiChange: v as ApiChange })}
      />

      <section className="dvs-lab__result" aria-label="결과">
        <p className="dvs-lab__verdict" data-broken={broken > 0}>
          {broken === 0 ? '옛 탭 요청이 모두 성공해요' : `깨진 요청이 ${broken}칸에서 나와요`}
        </p>
        <ul className="dvs-lab__reasons">
          <li>{STRATEGY_REASON[options.strategy]}</li>
          <li>{API_REASON[options.apiChange]}</li>
          <li>{ASSET_REASON[options.keepAssets ? 'keep' : 'drop']}</li>
        </ul>

        <div className="dvs-lab__scroll">
          <table className="dvs-lab__table" aria-label="칸별 옛 탭 요청 결과 (예시)">
            <thead>
              <tr>
                <th scope="col">칸</th>
                {results.map((r) => (
                  <th key={r.step} scope="col">
                    {r.step === 0 ? '배포 전' : r.step}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">새 버전 응답</th>
                {results.map((r) => (
                  <td key={r.step}>{pctText(r.newShare)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">성공</th>
                {results.map((r) => (
                  <td key={r.step}>{pctText(r.ok)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">필드 누락</th>
                {results.map((r) => (
                  <td key={r.step} data-broken={r.missing > 0}>
                    {pctText(r.missing)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">청크 404</th>
                {results.map((r) => (
                  <td key={r.step} data-broken={r.chunk404 > 0}>
                    {pctText(r.chunk404)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="dvs-lab__hint">칸 하나는 배포 진행 단계예요. 비율과 칸 수는 판단을 돕는 예시예요.</p>
      </section>
    </div>
  );
}
