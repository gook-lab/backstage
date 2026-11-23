/** 업로드 파일의 실제 형식. 첫 바이트와 내용이 말하는 값이에요 */
export type FileKind = 'png' | 'jpeg' | 'html' | 'svg';

export interface UploadSample {
  id: string;
  label: string;
  /** 사용자가 붙인 파일 이름. 이름은 바꿀 수 있어요 */
  fileName: string;
  /** 요청에 실린 Content-Type. 보내는 쪽이 정한 값이에요 */
  declaredType: string;
  kind: FileKind;
  /** 전송 크기 (바이트) */
  bytes: number;
  /** 이미지의 가로 · 세로 (px). HTML · SVG 예시는 0 */
  width: number;
  height: number;
  /** EXIF 에 촬영 위치(GPS)가 들어 있나요? */
  hasLocation: boolean;
  /** 파일 안에 실행될 스크립트가 있나요? */
  hasScript: boolean;
}

export interface UploadConfig {
  extension: boolean;
  contentType: boolean;
  magic: boolean;
  size: boolean;
  reencode: boolean;
  separateHost: boolean;
  headers: boolean;
}

export type StageId = 'extension' | 'contentType' | 'magic' | 'size' | 'reencode';

export interface StageResult {
  id: StageId;
  label: string;
  status: 'passed' | 'rejected' | 'skipped';
  reason: string;
}

export type Severity = 'high' | 'medium' | 'low';

export interface Risk {
  id: string;
  severity: Severity;
  text: string;
}

export interface Verdict {
  accepted: boolean;
  rejectedBy?: StageId;
  stages: StageResult[];
  risks: Risk[];
}

/** 예시 한도. 실제 서비스에 맞춰 정하는 값이에요 */
export const LIMITS = { maxBytes: 5_000_000, maxSide: 10_000, maxPixels: 25_000_000 } as const;

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const IMAGE_KINDS: readonly FileKind[] = ['png', 'jpeg'];

export const STAGE_LABEL: Record<StageId, string> = {
  extension: '확장자 허용 목록',
  contentType: 'Content-Type 허용 목록',
  magic: '첫 바이트 (매직 넘버)',
  size: '크기 · 해상도 한도',
  reencode: '재인코딩',
};

const STAGE_ORDER: readonly StageId[] = ['extension', 'contentType', 'magic', 'size', 'reencode'];

export const KIND_LABEL: Record<FileKind, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  html: 'HTML 텍스트',
  svg: 'SVG 텍스트',
};

export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.round(bytes / 1_000)}KB`;

/** RGBA 4바이트로 펼칠 때 필요한 메모리 (계산 예시) */
export const decodedGb = (width: number, height: number) => ((width * height * 4) / 1e9).toFixed(1);

const extensionOf = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

interface Check {
  ok: boolean;
  reason: string;
}

function checkStage(id: StageId, sample: UploadSample, current: UploadSample): Check {
  switch (id) {
    case 'extension': {
      const ext = extensionOf(sample.fileName);
      return IMAGE_EXTENSIONS.includes(ext)
        ? { ok: true, reason: `.${ext} 는 허용 목록에 있어요. 다만 이름은 사용자가 바꿀 수 있어요.` }
        : { ok: false, reason: `.${ext} 는 허용 목록에 없어요.` };
    }
    case 'contentType':
      return IMAGE_TYPES.includes(sample.declaredType)
        ? { ok: true, reason: `${sample.declaredType} 는 허용 목록에 있어요. 다만 보내는 쪽이 정한 값이에요.` }
        : { ok: false, reason: `${sample.declaredType} 는 이미지 허용 목록에 없어요.` };
    case 'magic':
      if (IMAGE_KINDS.includes(current.kind)) {
        return {
          ok: true,
          reason: `${KIND_LABEL[current.kind]} 시그니처로 시작해요. 시그니처 뒤의 내용은 이 검사가 보지 않아요.`,
        };
      }
      return { ok: false, reason: '첫 바이트에 PNG · JPEG 시그니처가 없어요.' };
    case 'size': {
      const isImage = IMAGE_KINDS.includes(current.kind);
      const pixels = current.width * current.height;
      if (current.bytes > LIMITS.maxBytes) {
        return { ok: false, reason: `파일이 ${formatBytes(current.bytes)} 예요. 예시 한도는 5MB 예요.` };
      }
      if (isImage && (current.width > LIMITS.maxSide || current.height > LIMITS.maxSide)) {
        return { ok: false, reason: `가로 또는 세로가 ${LIMITS.maxSide}px 를 넘어요.` };
      }
      if (isImage && pixels > LIMITS.maxPixels) {
        return {
          ok: false,
          reason: `픽셀 수가 한도(2500만)를 넘어요. 디코딩하면 RGBA 로 약 ${decodedGb(current.width, current.height)}GB 가 필요해요 (계산 예시).`,
        };
      }
      const size = isImage ? `, 가로 ${current.width} · 세로 ${current.height}px` : '';
      return { ok: true, reason: `${formatBytes(current.bytes)}${size} 로 한도 안이에요.` };
    }
    case 'reencode':
      return IMAGE_KINDS.includes(current.kind)
        ? { ok: true, reason: '새 이미지로 다시 저장해서 위치 정보와 덧붙은 내용을 버렸어요.' }
        : { ok: false, reason: `${KIND_LABEL[current.kind]} 는 PNG · JPEG 로 디코딩할 수 없어요.` };
  }
}

const isEnabled = (id: StageId, c: UploadConfig): boolean => {
  switch (id) {
    case 'extension':
      return c.extension;
    case 'contentType':
      return c.contentType;
    case 'magic':
      return c.magic;
    case 'size':
      return c.size;
    case 'reencode':
      return c.reencode;
  }
};

export function inspect(sample: UploadSample, config: UploadConfig): Verdict {
  const stages: StageResult[] = [];
  let current: UploadSample = { ...sample };
  let rejectedBy: StageId | undefined;

  for (const id of STAGE_ORDER) {
    const label = STAGE_LABEL[id];
    if (rejectedBy) {
      stages.push({ id, label, status: 'skipped', reason: '앞 단계에서 이미 거절했어요.' });
      continue;
    }
    if (!isEnabled(id, config)) {
      stages.push({ id, label, status: 'skipped', reason: '이 단계를 껐어요.' });
      continue;
    }
    const check = checkStage(id, sample, current);
    if (!check.ok) {
      rejectedBy = id;
      stages.push({ id, label, status: 'rejected', reason: check.reason });
      continue;
    }
    if (id === 'reencode') {
      // 재인코딩은 픽셀만 새로 쓰므로 위치 정보와 스크립트 바이트가 남지 않아요
      current = { ...current, hasLocation: false, hasScript: false };
    }
    stages.push({ id, label, status: 'passed', reason: check.reason });
  }

  if (rejectedBy) {
    return { accepted: false, rejectedBy, stages, risks: [] };
  }

  const risks: Risk[] = [];
  const isImage = IMAGE_KINDS.includes(current.kind);
  if (isImage && current.width * current.height > LIMITS.maxPixels) {
    risks.push({
      id: 'bomb',
      severity: 'high',
      text: `디코딩할 때 RGBA 로 약 ${decodedGb(current.width, current.height)}GB 의 메모리를 쓸 수 있어요 (계산 예시).`,
    });
  }
  if (current.hasLocation) {
    risks.push({
      id: 'location',
      severity: 'high',
      text: '촬영 위치(EXIF GPS)가 파일에 그대로 남아 있어요. 공개 주소를 받은 사람이 읽을 수 있어요.',
    });
  }
  if (current.hasScript) {
    if (config.separateHost) {
      risks.push({
        id: 'script-other',
        severity: 'medium',
        text: '다른 도메인에서 스크립트가 실행돼요. 앱 도메인과 출처가 달라 앱의 쿠키와 저장소에 닿지 않아요.',
      });
    } else {
      risks.push({
        id: 'script-app',
        severity: 'high',
        text: '앱 도메인에서 스크립트가 실행될 수 있어요. 앱과 같은 출처라 앱의 쿠키와 저장소에 닿을 수 있어요.',
      });
    }
    if (!config.headers) {
      risks.push({
        id: 'sniff',
        severity: 'medium',
        text: 'nosniff 가 없어 브라우저가 내용으로 타입을 추측할 수 있어요.',
      });
    }
  }
  risks.push({
    id: 'malware',
    severity: 'low',
    text: '알려지지 않은 악성 내용은 이 검사로 걸러지지 않아요. 악성코드 검사와 격리 단계가 따로 필요해요.',
  });

  return { accepted: true, stages, risks };
}

export const PRESETS: readonly { id: string; label: string; config: UploadConfig }[] = [
  {
    id: 'fe-only',
    label: '확장자 · Content-Type 만',
    config: {
      extension: true,
      contentType: true,
      magic: false,
      size: false,
      reencode: false,
      separateHost: false,
      headers: false,
    },
  },
  {
    id: 'server-basic',
    label: '형식 · 크기까지',
    config: {
      extension: true,
      contentType: true,
      magic: true,
      size: true,
      reencode: false,
      separateHost: false,
      headers: false,
    },
  },
  {
    id: 'recommended',
    label: '권장 조합',
    config: {
      extension: true,
      contentType: true,
      magic: true,
      size: true,
      reencode: true,
      separateHost: true,
      headers: true,
    },
  },
];

export const DEFAULT_CONFIG: UploadConfig = PRESETS[0].config;

export const SAMPLES: readonly UploadSample[] = [
  {
    id: 'png-ok',
    label: '정상 PNG',
    fileName: 'avatar.png',
    declaredType: 'image/png',
    kind: 'png',
    bytes: 180_000,
    width: 512,
    height: 512,
    hasLocation: false,
    hasScript: false,
  },
  {
    id: 'html-as-png',
    label: '확장자만 png 인 HTML',
    fileName: 'profile.png',
    declaredType: 'image/png',
    kind: 'html',
    bytes: 2_000,
    width: 0,
    height: 0,
    hasLocation: false,
    hasScript: true,
  },
  {
    id: 'svg-script',
    label: 'SVG 안 스크립트',
    fileName: 'logo.svg',
    declaredType: 'image/svg+xml',
    kind: 'svg',
    bytes: 4_000,
    width: 0,
    height: 0,
    hasLocation: false,
    hasScript: true,
  },
  {
    id: 'huge-png',
    label: '작은 파일 · 50000×50000 이미지',
    fileName: 'banner.png',
    declaredType: 'image/png',
    kind: 'png',
    bytes: 40_000,
    width: 50_000,
    height: 50_000,
    hasLocation: false,
    hasScript: false,
  },
  {
    id: 'jpeg-gps',
    label: '위치 EXIF 가 있는 JPEG',
    fileName: 'trip.jpg',
    declaredType: 'image/jpeg',
    kind: 'jpeg',
    bytes: 3_500_000,
    width: 4_000,
    height: 3_000,
    hasLocation: true,
    hasScript: false,
  },
  {
    id: 'png-html',
    label: 'PNG 머리에 HTML 을 붙인 파일',
    fileName: 'cover.png',
    declaredType: 'image/png',
    kind: 'png',
    bytes: 6_000,
    width: 800,
    height: 600,
    hasLocation: false,
    hasScript: true,
  },
];
