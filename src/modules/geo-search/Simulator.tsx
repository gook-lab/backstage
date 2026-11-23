import { Button, Checkbox, RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useId, useState } from 'react';
import {
  AREA,
  CELL,
  CENTER,
  CLUSTER_ZOOM,
  LIMIT,
  MAX_ZOOM,
  MIN_ZOOM,
  STRATEGIES,
  STRATEGY_LABEL,
  type Strategy,
  type Viewport,
  simulate,
} from './model';
import './Simulator.css';

const STRATEGY_HINT: Record<Strategy, string> = {
  scan: '점 전부를 하나씩 확인해요. 점이 늘면 검사 수도 그대로 늘어요.',
  bbox: '지도 상자 안의 점만 찾는다고 가정해요. 검사 수가 화면 안 점 수와 같아요.',
  cell: '상자와 겹치는 격자 셀의 점을 먼저 가져와요. 셀 가장자리 바깥의 점도 함께 검사해요.',
};

const MAP_SIZE = 300;
const SW_LNG = CENTER.lng - AREA / 2;
const NORTH_LAT = CENTER.lat + AREA / 2;
const toX = (lng: number) => ((lng - SW_LNG) / AREA) * MAP_SIZE;
const toY = (lat: number) => ((NORTH_LAT - lat) / AREA) * MAP_SIZE;
const sizeX = (dLng: number) => (dLng / AREA) * MAP_SIZE;

function viewportRect(vp: Viewport) {
  return {
    x: toX(vp.west),
    y: toY(vp.north),
    width: sizeX(vp.east - vp.west),
    height: sizeX(vp.north - vp.south),
  };
}

export default function Simulator() {
  const mapId = useId();
  const [points, setPoints] = useState(500);
  const [zoom, setZoom] = useState(9);
  const [strategy, setStrategy] = useState<Strategy>('scan');
  const [cluster, setCluster] = useState(false);
  const [seed, setSeed] = useState(7);

  const result = simulate({ points, zoom, strategy, cluster, seed });
  const vp = viewportRect(result.viewport);
  const span = result.viewport.east - result.viewport.west;
  const kb = (result.bytes / 1024).toFixed(1);

  return (
    <div className="gs-lab">
      <RadioGroup
        label="질의 방식"
        options={STRATEGIES.map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))}
        value={strategy}
        onValueChange={setStrategy}
      />
      <p className="gs-lab__hint">{STRATEGY_HINT[strategy]}</p>

      <div className="gs-lab__controls">
        <label className="gs-field">
          <span>
            줌 {zoom} · 경도 폭 약 {span.toFixed(2)}도 (예시)
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="gs-field">
          <span>점 {points}개 (가짜 좌표)</span>
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </label>
      </div>

      <Checkbox
        label="줌이 낮으면 서버에서 묶어서 보내기"
        hint={`줌 ${CLUSTER_ZOOM} 미만에서만 묶어요. 지금은 ${zoom < CLUSTER_ZOOM ? '묶어서 보내요' : '묶지 않아요'}.`}
        checked={cluster}
        onCheckedChange={(checked) => setCluster(checked === true)}
      />

      <div className="gs-lab__seed">
        <span>시드 {seed} · 같은 시드는 같은 점 배치예요</span>
        <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
          다른 시드로 다시 돌리기
        </Button>
      </div>

      <section className="gs-lab__map" aria-labelledby={`${mapId}-map`}>
        <h3 id={`${mapId}-map`}>지도 영역과 검사 범위</h3>
        <svg className="gs-map" viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} aria-hidden="true" focusable="false">
          {result.cells.map((c) => {
            const south = c.row * CELL + (CENTER.lat - AREA / 2);
            const west = c.col * CELL + SW_LNG;
            return (
              <rect
                key={`${c.row}:${c.col}`}
                className="gs-map__cell"
                x={toX(west)}
                y={toY(south + CELL)}
                width={sizeX(CELL)}
                height={sizeX(CELL)}
              />
            );
          })}
          {result.points.map((p) => (
            <circle key={p.id} className="gs-map__dot" cx={toX(p.lng)} cy={toY(p.lat)} r={1} />
          ))}
          {result.clustered
            ? result.groups.map((g) => (
                <circle
                  key={`${g.lat}:${g.lng}`}
                  className="gs-map__group"
                  cx={toX(g.lng)}
                  cy={toY(g.lat)}
                  r={2 + Math.sqrt(g.count)}
                />
              ))
            : result.shown.map((p) => (
                <circle key={p.id} className="gs-map__shown" cx={toX(p.lng)} cy={toY(p.lat)} r={1.6} />
              ))}
          <rect className="gs-map__view" x={vp.x} y={vp.y} width={vp.width} height={vp.height} />
        </svg>
        <p className="gs-lab__note">
          사각형이 지도 화면이에요.{' '}
          {result.clustered ? '묶음 원의 크기는 개수를 뜻해요.' : '진한 점이 응답에 담긴 점이에요.'}
        </p>
      </section>

      <section className="gs-lab__results" aria-label="결과">
        <Stat label="검사한 점" value={result.examined} unit="개" />
        <Stat label="화면 안 점" value={result.matched} unit="개" />
        <Stat label="응답으로 돌려준 것" value={result.returned} unit={result.clustered ? '묶음' : '개'} />
        <Stat label="응답 크기 (예시)" value={kb} unit="KB" />
      </section>

      {result.cut > 0 && (
        <p className="gs-lab__alarm" role="status">
          화면 안에 점이 {result.matched}개 있지만 응답에는 {result.returned}개만 담았어요. 나머지 {result.cut}개는
          지도에 나오지 않아요. <Tag variant="accent">{result.cut}개 잘림</Tag>
        </p>
      )}

      <p className="gs-lab__note">
        응답 상한은 {LIMIT}개예요. 질의 방식은 검사 수를 바꾸고, 묶기는 응답 크기를 바꿔요. 셀 한 변은 {CELL}도예요.
      </p>
      <p className="gs-lab__foot">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
