import { Checkbox, RadioGroup } from '@gook-lab/ui';
import { useState } from 'react';
import {
  DEFAULT_CONFIG,
  formatBytes,
  inspect,
  KIND_LABEL,
  PRESETS,
  SAMPLES,
  type Severity,
  STAGE_LABEL,
  type UploadConfig,
} from './model';
import './Simulator.css';

const FLAGS: readonly { key: keyof UploadConfig; label: string; hint: string }[] = [
  {
    key: 'extension',
    label: '확장자 허용 목록',
    hint: '.png · .jpg · .jpeg 만 받아요. 이름은 사용자가 바꿀 수 있어요.',
  },
  {
    key: 'contentType',
    label: 'Content-Type 허용 목록',
    hint: 'image/png · image/jpeg 만 받아요. 보내는 쪽이 정한 값이에요.',
  },
  {
    key: 'magic',
    label: '첫 바이트 (매직 넘버)',
    hint: 'PNG · JPEG 시그니처로 형식을 가려요. 첫 바이트만 봐요.',
  },
  {
    key: 'size',
    label: '크기 · 해상도 한도',
    hint: '파일 크기, 가로 · 세로, 픽셀 수를 디코딩 전에 확인해요.',
  },
  {
    key: 'reencode',
    label: '재인코딩',
    hint: '이미지를 디코드한 뒤 새 파일로 다시 저장해요. 위치 정보와 덧붙은 내용이 사라져요.',
  },
  {
    key: 'separateHost',
    label: '다른 도메인에서 서빙',
    hint: '업로드 파일을 앱과 다른 도메인에서 내려줘요.',
  },
  {
    key: 'headers',
    label: '응답 헤더 nosniff · attachment',
    hint: 'nosniff 로 타입 추측을 막고, attachment 로 내려받게 해요.',
  },
];

const STATUS_LABEL = { passed: '통과', rejected: '거절', skipped: '건너뜀' } as const;
const SEVERITY_LABEL: Record<Severity, string> = { high: '높음', medium: '중간', low: '낮음' };

export default function Simulator() {
  const [config, setConfig] = useState<UploadConfig>(DEFAULT_CONFIG);
  const [presetId, setPresetId] = useState('fe-only');
  const [sampleId, setSampleId] = useState('html-as-png');

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const verdict = inspect(sample, config);

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const setFlag = (key: keyof UploadConfig, on: boolean) => {
    setPresetId('');
    setConfig((prev) => ({ ...prev, [key]: on }));
  };

  return (
    <div className="uc-lab">
      <RadioGroup
        label="업로드 파일 예시"
        options={SAMPLES.map((s) => ({ value: s.id, label: s.label }))}
        value={sampleId}
        onValueChange={setSampleId}
      />

      <dl className="uc-lab__file">
        <div>
          <dt>파일 이름</dt>
          <dd>{sample.fileName}</dd>
        </div>
        <div>
          <dt>보낸 Content-Type</dt>
          <dd>{sample.declaredType}</dd>
        </div>
        <div>
          <dt>첫 바이트가 말하는 형식</dt>
          <dd>{KIND_LABEL[sample.kind]}</dd>
        </div>
        <div>
          <dt>전송 크기</dt>
          <dd>{formatBytes(sample.bytes)}</dd>
        </div>
        <div>
          <dt>가로 × 세로</dt>
          <dd>{sample.width && sample.height ? `${sample.width} × ${sample.height}px` : '해당 없음'}</dd>
        </div>
        <div>
          <dt>EXIF 위치 값</dt>
          <dd>{sample.hasLocation ? '있음 (GPS)' : '없음'}</dd>
        </div>
        <div>
          <dt>실행될 스크립트</dt>
          <dd>{sample.hasScript ? '있음' : '없음'}</dd>
        </div>
      </dl>

      <RadioGroup
        label="검사 조합 예시"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={presetId}
        onValueChange={choosePreset}
      />

      <div className="uc-lab__checks">
        {FLAGS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            hint={f.hint}
            checked={config[f.key]}
            onCheckedChange={(checked) => setFlag(f.key, checked === true)}
          />
        ))}
      </div>

      <section className="uc-lab__result" aria-label="검사 결과">
        <p className="uc-lab__verdict" data-verdict={verdict.accepted ? 'accepted' : 'rejected'}>
          {verdict.accepted
            ? '통과했어요'
            : `${verdict.rejectedBy ? STAGE_LABEL[verdict.rejectedBy] : ''} 단계에서 거절했어요`}
        </p>
        <p className="uc-lab__hint">
          {verdict.accepted ? '파일이 저장돼요. 아래 남는 위험을 확인해요.' : '거절된 파일은 저장되지 않아요.'}
        </p>

        <h3>단계별 판정</h3>
        <ol className="uc-lab__stages">
          {verdict.stages.map((st) => (
            <li key={st.id} data-status={st.status}>
              <span className="uc-lab__tag">{STATUS_LABEL[st.status]}</span>
              <strong>{st.label}</strong>
              <span className="uc-lab__reason">{st.reason}</span>
            </li>
          ))}
        </ol>

        <h3>남는 위험</h3>
        {verdict.accepted ? (
          <ul className="uc-lab__risks">
            {verdict.risks.map((r) => (
              <li key={r.id} data-severity={r.severity}>
                <span className="uc-lab__tag">{SEVERITY_LABEL[r.severity]}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="uc-lab__hint">거절돼서 남는 위험이 없어요.</p>
        )}
      </section>

      <p className="uc-lab__hint">수치는 감을 잡기 위한 예시예요.</p>
    </div>
  );
}
