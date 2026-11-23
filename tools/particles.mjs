// 영문 · 숫자 · 코드 뒤 조사를 붙여 쓴다(한글 맞춤법: 조사는 앞말에 붙여 씀).
// node tools/particles.mjs        → 고칠 곳이 있으면 목록을 내고 실패
// node tools/particles.mjs --fix  → 파일을 고침
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const PARTICLES = [
  '이에요',
  '예요',
  '이라고',
  '라고',
  '이라',
  '이란',
  '란',
  '에서',
  '에게',
  '으로',
  '로',
  '까지',
  '부터',
  '처럼',
  '보다',
  '이나',
  '나',
  '이랑',
  '랑',
  '이고',
  '이며',
  '이면',
  '이든',
  '든',
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '의',
  '에',
  '와',
  '과',
  '도',
  '만',
];
const BEFORE = String.raw`[A-Za-z0-9)\]\`'"%+]`;
const AFTER = String.raw`(?=[\s.,)!?:;·|]|$)`;
const RE = new RegExp(`(${BEFORE}) +(${PARTICLES.join('|')})${AFTER}`, 'gm');

/** 코드 블록 · 인라인 코드 안은 건드리지 않는다 */
function transform(text) {
  const parts = text.split(/(```[\s\S]*?```)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .split(/(`[^`\n]*`)/)
        .map((seg, j, all) => {
          if (j % 2 === 1) return seg;
          // 인라인 코드 바로 뒤 조각은 앞 글자가 백틱이므로 경계 문자를 붙여 검사한다
          const prev = j > 0 ? '`' : '';
          return (prev + seg).replace(RE, '$1$2').slice(prev.length);
        })
        .join('');
    })
    .join('');
}

const files = globSync('src/modules/*/{Article.mdx,index.ts}');
const fix = process.argv.includes('--fix');
let dirty = 0;
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  const after = transform(before);
  if (before === after) continue;
  dirty += 1;
  if (fix) writeFileSync(f, after);
  else console.log(`조사 띄어 씀: ${f}`);
}
if (!fix && dirty > 0) {
  console.log(`\n${dirty}개 파일. node tools/particles.mjs --fix 로 고쳐요.`);
  process.exit(1);
}
