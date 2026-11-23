import { Button, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import { effectivePartMiB, FILE_SIZES, formatMiB, PART_SIZES, simulate, type Transfer } from './model';
import './Simulator.css';

const DEFAULT_FILE = '10240';
const DEFAULT_PART = '16';
const DEFAULT_DROP = 10;

function outcome(t: Transfer): string {
  return t.completed ? '완료' : '끝까지 못 보냈어요';
}

export default function Simulator() {
  const [fileValue, setFileValue] = useState(DEFAULT_FILE);
  const [partValue, setPartValue] = useState(DEFAULT_PART);
  const [dropPercent, setDropPercent] = useState(DEFAULT_DROP);
  const [seed, setSeed] = useState(7);

  const fileMiB = FILE_SIZES.find((f) => f.value === fileValue)?.mib ?? 10240;
  const partMiB = Number(partValue);
  const appliedPart = effectivePartMiB(fileMiB, partMiB);
  const { single, multipart } = simulate({ fileMiB, partMiB, dropPer100MiB: dropPercent / 100, seed });

  return (
    <div className="fu-lab">
      <RadioGroup
        label="파일 크기"
        options={FILE_SIZES.map((f) => ({ value: f.value, label: f.label }))}
        value={fileValue}
        onValueChange={setFileValue}
      />

      <RadioGroup
        label="조각 크기 (멀티파트)"
        options={PART_SIZES.map((p) => ({ value: p.value, label: p.label }))}
        value={partValue}
        onValueChange={setPartValue}
      />
      {appliedPart !== partMiB && (
        <p className="fu-lab__hint">조각은 10,000 개를 넘을 수 없어서 {formatMiB(appliedPart)} 로 올려 계산해요.</p>
      )}

      <label className="fu-lab__range">
        <span>100 MiB 를 보내는 동안 연결이 끊길 확률 · {dropPercent}%</span>
        <input
          type="range"
          min={0}
          max={30}
          step={5}
          value={dropPercent}
          onChange={(e) => setDropPercent(Number(e.target.value))}
        />
        <span className="fu-lab__hint">끊김은 보낸 양에 비례해 생겨요. 같은 시드에서는 항상 같은 순간에 끊겨요.</span>
      </label>

      <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
        다른 끊김 패턴으로 다시 돌리기
      </Button>

      <table className="fu-lab__table" aria-label="업로드 비교 결과">
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">단일 업로드</th>
            <th scope="col">멀티파트 업로드</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">결과</th>
            <td data-outcome={single.completed ? 'ok' : 'fail'}>{outcome(single)}</td>
            <td data-outcome={multipart.completed ? 'ok' : 'fail'}>{outcome(multipart)}</td>
          </tr>
          <tr>
            <th scope="row">네트워크로 나간 총량</th>
            <td>{formatMiB(single.sentMiB)}</td>
            <td>{formatMiB(multipart.sentMiB)}</td>
          </tr>
          <tr>
            <th scope="row">끊겨서 다시 보낸 양</th>
            <td>{formatMiB(single.wastedMiB)}</td>
            <td>{formatMiB(multipart.wastedMiB)}</td>
          </tr>
          <tr>
            <th scope="row">시도 횟수</th>
            <td>{single.attempts}번</td>
            <td>{multipart.attempts}번</td>
          </tr>
          <tr>
            <th scope="row">조각 수</th>
            <td>1개</td>
            <td>{multipart.parts.toLocaleString('ko-KR')}개</td>
          </tr>
        </tbody>
      </table>

      <p className="fu-lab__hint">
        단일 업로드는 한 번 끊기면 처음부터 다시 보내요. 멀티파트는 끊긴 조각만 다시 보내요. 끊김 확률과 시도 한도는
        설명을 위한 예시예요. 실제 망 상태는 기기와 환경마다 달라요.
      </p>
    </div>
  );
}
