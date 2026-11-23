import { RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DEFAULT_SCENARIO,
  formatSeconds,
  hitRate,
  type Layout,
  type RenderMode,
  type Scenario,
  simulate,
} from './model';
import './Simulator.css';

const LAYOUT_OPTIONS: readonly { value: Layout; label: string; hint: string }[] = [
  {
    value: 'shared',
    label: '공용만',
    hint: '로그인과 상관없이 같은 HTML이에요.',
  },
  {
    value: 'mixed',
    label: '공용 + 개인 섞임',
    hint: '한 HTML 안에 로그인 헤더가 들어가요. 쿠키가 붙은 요청은 공유 캐시를 건너뛰도록 설정했다고 가정해요.',
  },
  {
    value: 'split',
    label: '공용 HTML + 개인 부분 따로',
    hint: '공용 HTML은 공유 캐시에 두고, 개인 부분은 클라이언트가 따로 요청해요.',
  },
];

const MODE_OPTIONS: readonly { value: RenderMode; label: string }[] = [
  { value: 'request', label: '요청마다 렌더링' },
  { value: 'revalidate', label: '재검증 간격마다 렌더링' },
  { value: 'build', label: '빌드 때만 렌더링 (예시: 6시간마다 배포)' },
];

const INTERVAL_OPTIONS: { value: string; label: string }[] = [
  { value: '10', label: '10초' },
  { value: '60', label: '1분' },
  { value: '600', label: '10분' },
  { value: '3600', label: '1시간' },
];

const LOGGED_IN_OPTIONS: { value: string; label: string }[] = [
  { value: '0.1', label: '10%' },
  { value: '0.3', label: '30%' },
  { value: '0.6', label: '60%' },
];

const RPS_OPTIONS: { value: string; label: string }[] = [
  { value: '5', label: '초당 5건' },
  { value: '20', label: '초당 20건' },
  { value: '100', label: '초당 100건' },
];

const CHANGE_OPTIONS: { value: string; label: string }[] = [
  { value: String(9 * 3600), label: '오전 9시' },
  { value: String(13 * 3600), label: '오후 1시' },
  { value: String(17 * 3600), label: '오후 5시' },
];

const LAYOUT_NOTE: Record<Layout, string> = {
  shared: '모든 요청이 같은 공용 HTML을 받아요. 캐시 규칙을 한 번만 정하면 돼요.',
  mixed: '로그인 요청은 공유 캐시를 건너뛰어서 매번 원 서버에서 렌더링해요.',
  split: '공용 HTML은 캐시가 답하고, 로그인 요청만 개인 부분을 원 서버에 따로 불러요.',
};

const MODE_NOTE: Record<RenderMode, string> = {
  request: '매 요청마다 렌더링해서 캐시가 답하는 요청이 없어요. 가격 변경은 바로 보여요.',
  revalidate: '저장본이 간격 안에 있는 동안 같은 옛 값을 보여 줘요. 간격이 곧 옛 값의 최대 길이예요.',
  build: '공용 HTML은 배포 때 만들어져서, 가격을 바꿔도 다음 배포 전까지 옛 값이 남아요.',
};

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

export default function Simulator() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);

  const update = (patch: Partial<Scenario>) => setScenario((prev) => ({ ...prev, ...patch }));

  const result = simulate(scenario);
  const rate = hitRate(result);
  const isSplit = scenario.layout === 'split';
  const isRevalidate = scenario.mode === 'revalidate';
  const changeLabel = CHANGE_OPTIONS.find((o) => o.value === String(scenario.changeAtSecond))?.label ?? '';

  return (
    <div className="rc-lab">
      <div className="rc-lab__controls">
        <RadioGroup
          label="페이지 구성"
          options={LAYOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.layout}
          onValueChange={(v) => update({ layout: v as Layout })}
        />
        <p className="rc-lab__hint">{LAYOUT_OPTIONS.find((o) => o.value === scenario.layout)?.hint}</p>

        <RadioGroup
          label="렌더링 방식"
          options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={scenario.mode}
          onValueChange={(v) => update({ mode: v as RenderMode })}
        />

        {isRevalidate && (
          <RadioGroup
            label="재검증 간격"
            options={INTERVAL_OPTIONS}
            value={String(scenario.revalidateSeconds)}
            onValueChange={(v) => update({ revalidateSeconds: Number(v) })}
          />
        )}

        <RadioGroup
          label="로그인 사용자 비율"
          options={LOGGED_IN_OPTIONS}
          value={String(scenario.loggedInRatio)}
          onValueChange={(v) => update({ loggedInRatio: Number(v) })}
        />

        <RadioGroup
          label="요청량 (예시)"
          options={RPS_OPTIONS}
          value={String(scenario.requestsPerSecond)}
          onValueChange={(v) => update({ requestsPerSecond: Number(v) })}
        />

        <RadioGroup
          label="상품 가격이 바뀌는 시각"
          options={CHANGE_OPTIONS}
          value={String(scenario.changeAtSecond)}
          onValueChange={(v) => update({ changeAtSecond: Number(v) })}
        />
      </div>

      <section className="rc-lab__result" aria-label="결과">
        <p className="rc-lab__summary">
          하루 요청 {fmt(result.pageRequests)}건 중 캐시가 답한 요청은 {Math.round(rate * 100)}%예요.
        </p>
        <p className="rc-lab__hint">{LAYOUT_NOTE[scenario.layout]}</p>
        <p className="rc-lab__hint">{MODE_NOTE[scenario.mode]}</p>

        <dl className="rc-lab__metrics">
          <div className="rc-metric">
            <dt>원 서버 상품 페이지 렌더링</dt>
            <dd>{fmt(result.originRenders)}회</dd>
          </div>
          <div className="rc-metric">
            <dt>캐시 적중률</dt>
            <dd>{Math.round(rate * 100)}%</dd>
          </div>
          {isSplit && (
            <div className="rc-metric">
              <dt>개인 부분 원 서버 호출</dt>
              <dd>{fmt(result.personalCalls)}회</dd>
            </div>
          )}
          <div className="rc-metric">
            <dt>옛 가격 응답</dt>
            <dd>{fmt(result.oldServed)}건</dd>
          </div>
          <div className="rc-metric">
            <dt>옛 가격이 나간 최대 시간</dt>
            <dd>{formatSeconds(result.oldExposureSeconds)}</dd>
          </div>
        </dl>

        <p className="rc-lab__hint">
          하루(0시부터 24시간)를 1초씩 셌고, 가격은 {changeLabel}에 바뀌어요. 수치는 감을 잡기 위한 예시예요.
        </p>
      </section>
    </div>
  );
}
