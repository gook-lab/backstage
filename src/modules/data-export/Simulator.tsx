import { RadioGroup, Stat, Tag } from '@gook-lab/ui';
import { useState } from 'react';
import {
  escapeCsvField,
  formatMB,
  formatSec,
  type Guard,
  guardField,
  hasFormulaRisk,
  METHOD_HINT,
  METHOD_LABEL,
  METHODS,
  type Method,
  ROW_STEPS,
  estimateExport,
} from './model';
import './Simulator.css';

const GUARDS: readonly Guard[] = ['none', 'apostrophe', 'tab'];
const GUARD_LABEL: Record<Guard, string> = {
  none: '그대로 쓰기',
  apostrophe: '작은 따옴표 붙이기',
  tab: '따옴표 안에서 탭 붙이기',
};

const METHOD_TIMEOUT_NOTE: Record<Method, string> = {
  memory: '첫 바이트가 제한 안에 나가지 않아서 게이트웨이가 504 로 끊어요.',
  stream: '배치 하나를 쓰는 데 걸리는 시간이 제한을 넘어서 504 로 끊어요.',
  async: '접수 응답이 제한을 넘어서 504 로 끊어요.',
};

export default function Simulator() {
  const [method, setMethod] = useState<Method>('memory');
  const [rowIndex, setRowIndex] = useState(3);
  const [batchSize, setBatchSize] = useState(1000);
  const [gatewayLimitSec, setGatewayLimitSec] = useState(30);
  const [sample, setSample] = useState('=1+2');
  const [guard, setGuard] = useState<Guard>('none');

  const rows = ROW_STEPS[rowIndex];
  const est = estimateExport({ method, rows, batchSize, gatewayLimitSec });
  const risky = hasFormulaRisk(sample);

  return (
    <div className="dx-lab">
      <RadioGroup
        label="생성 방식"
        options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        value={method}
        onValueChange={setMethod}
      />
      <p className="dx-lab__hint">{METHOD_HINT[method]}</p>

      <div className="dx-lab__controls">
        <label className="dx-field">
          <span>행 {rows.toLocaleString('ko-KR')}건</span>
          <input
            type="range"
            min={0}
            max={ROW_STEPS.length - 1}
            step={1}
            value={rowIndex}
            onChange={(e) => setRowIndex(Number(e.target.value))}
          />
        </label>
        <label className="dx-field">
          <span>배치 {batchSize.toLocaleString('ko-KR')}행</span>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={batchSize}
            disabled={method === 'memory'}
            onChange={(e) => setBatchSize(Number(e.target.value))}
          />
          {method === 'memory' && <small>메모리 방식은 배치를 쓰지 않아서 이 값이 영향을 주지 않아요.</small>}
        </label>
        <label className="dx-field">
          <span>게이트웨이 제한 {gatewayLimitSec}초</span>
          <input
            type="range"
            min={3}
            max={120}
            step={1}
            value={gatewayLimitSec}
            onChange={(e) => setGatewayLimitSec(Number(e.target.value))}
          />
        </label>
      </div>

      <section className="dx-lab__results" aria-label="결과">
        <Stat label={method === 'async' ? '202 접수 응답' : '첫 바이트'} value={formatSec(est.firstByteSec)} />
        <Stat label={method === 'async' ? '파일 준비' : '전체 응답 완료'} value={formatSec(est.doneSec)} />
        <Stat
          label="서버 최대 메모리"
          value={formatMB(est.peakMemoryMB)}
          tone={est.peakMemoryMB > 50 ? 'accent' : 'ink'}
        />
        <div className="dx-lab__gateway">
          <span>게이트웨이 타임아웃</span>
          <Tag variant={est.gatewayTimeout ? 'accent' : 'neutral'}>{est.gatewayTimeout ? '504' : '없음'}</Tag>
        </div>
      </section>

      {est.gatewayTimeout && (
        <p className="dx-lab__alarm" role="status">
          {METHOD_TIMEOUT_NOTE[method]} FE 에서는 타임아웃 화면만 보여요.
        </p>
      )}

      <section className="dx-lab__csv" aria-labelledby="dx-csv-title">
        <h3 id="dx-csv-title">셀 값 하나의 CSV 결과</h3>
        <label className="dx-field">
          <span>셀 값</span>
          <input type="text" value={sample} onChange={(e) => setSample(e.target.value)} />
        </label>
        <RadioGroup
          label="수식 주입 대응"
          options={GUARDS.map((g) => ({ value: g, label: GUARD_LABEL[g] }))}
          value={guard}
          onValueChange={setGuard}
        />
        <p className="dx-lab__note">
          RFC 4180 이스케이프: <code>{escapeCsvField(sample)}</code>
        </p>
        <p className="dx-lab__note">
          보낼 CSV 필드: <code>{guardField(sample, guard)}</code>
        </p>
        <p className="dx-lab__note">
          수식 주입 위험: {risky ? <Tag variant="accent">위험</Tag> : <Tag variant="neutral">없음</Tag>}
        </p>
        {guard === 'apostrophe' && (
          <p className="dx-lab__hint">
            OWASP 는 저장 뒤 다시 열면 엑셀이 따옴표를 지워 수식이 살아날 수 있다고 설명해요.
          </p>
        )}
        {guard === 'tab' && (
          <p className="dx-lab__hint">
            OWASP 가 엑셀에서 관찰됐다고 설명한 방식이에요. 탭이 데이터에 남아서 값이 바뀌고, 다른 프로그램에서는 다를
            수 있어요.
          </p>
        )}
      </section>

      <p className="dx-lab__note">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
