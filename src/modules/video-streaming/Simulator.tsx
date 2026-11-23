import { RadioGroup } from '@gook-lab/ui';
import { useMemo, useState } from 'react';
import {
  DELIVERIES,
  type DeliveryId,
  LIMIT_SECONDS,
  NETWORKS,
  type NetworkId,
  type PlayState,
  simulate,
} from './model';
import './Simulator.css';

const STATE_LABEL: Record<PlayState, string> = {
  waiting: '첫 화면 준비 중',
  playing: '재생 중',
  stalled: '멈춤',
  ended: '끝',
};

const NETWORK_OPTIONS = (Object.keys(NETWORKS) as NetworkId[]).map((id) => ({
  value: id,
  label: NETWORKS[id].label,
}));

const DELIVERY_OPTIONS = (Object.keys(DELIVERIES) as DeliveryId[]).map((id) => ({
  value: id,
  label: DELIVERIES[id].label,
}));

export default function Simulator() {
  const [network, setNetwork] = useState<NetworkId>('flicker');
  const [delivery, setDelivery] = useState<DeliveryId>('original');

  const result = useMemo(() => simulate(network, delivery), [network, delivery]);

  return (
    <div className="vs-lab">
      <div className="vs-lab__controls">
        <RadioGroup
          label="네트워크 연결"
          options={NETWORK_OPTIONS}
          value={network}
          onValueChange={(v) => setNetwork(v as NetworkId)}
        />
        <p className="vs-lab__hint">{NETWORKS[network].hint}</p>

        <RadioGroup
          label="전달 방식"
          options={DELIVERY_OPTIONS}
          value={delivery}
          onValueChange={(v) => setDelivery(v as DeliveryId)}
        />
        <p className="vs-lab__hint">{DELIVERIES[delivery].hint}</p>
      </div>

      <section className="vs-lab__result" aria-label="재생 결과">
        <p className="vs-lab__verdict" data-stalled={result.stallCount > 0 ? 'yes' : 'no'}>
          {result.stallCount === 0 ? '멈추지 않고 재생했어요.' : `재생이 ${result.stallCount}번 멈췄어요.`}
        </p>
        <p className="vs-lab__hint">
          {result.stallCount === 0
            ? '버퍼가 비지 않아서 화면이 끊기지 않았어요.'
            : '버퍼가 비면 플레이어는 재생을 멈추고 다시 채워질 때까지 기다려요.'}
        </p>

        <dl className="vs-lab__stats">
          <div>
            <dt>첫 재생까지</dt>
            <dd>{result.startupSec === undefined ? '시작하지 못했어요' : `${result.startupSec}초`}</dd>
          </div>
          <div>
            <dt>멈춘 시간</dt>
            <dd>{result.stallSec}초</dd>
          </div>
          <div>
            <dt>고른 화질 평균</dt>
            <dd>{result.avgMbps} Mbps</dd>
          </div>
          <div>
            <dt>화질 전환</dt>
            <dd>{result.switches}번</dd>
          </div>
        </dl>

        <p className="vs-lab__hint">
          {result.finished
            ? `${result.endSec}초에 끝까지 재생했어요.`
            : `${LIMIT_SECONDS}초 안에 끝까지 재생하지 못했어요.`}
        </p>

        <div className="vs-lab__table-wrap">
          <table className="vs-lab__table">
            <caption>5초마다 본 재생 상태</caption>
            <thead>
              <tr>
                <th scope="col">시간</th>
                <th scope="col">네트워크</th>
                <th scope="col">버퍼</th>
                <th scope="col">화질</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {result.frames.map((f, i) => (
                <tr key={`${f.at}-${i}`}>
                  <td>{f.at}초</td>
                  <td>{f.mbps} Mbps</td>
                  <td>{f.buffer}초</td>
                  <td>{f.rendition === undefined ? '-' : `${f.rendition} Mbps`}</td>
                  <td>{STATE_LABEL[f.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vs-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
      </section>
    </div>
  );
}
