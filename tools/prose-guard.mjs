// 문장 다듬기 전후로 사실 요소(숫자 · 링크 · 인라인 코드 · 코드 블록 · 헤딩)가 바뀌지 않았는지 대조해요.
// 사용: node tools/prose-guard.mjs [기준 ref, 기본 main]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'main';
const dir = 'src/modules';

const codeBlocks = (s) => s.match(/```[\s\S]*?```/g) ?? [];
const stripCode = (s) => s.replace(/```[\s\S]*?```/g, '');
const extract = (src) => {
  const text = stripCode(src);
  return {
    numbers: text.match(/\d[\d,.]*%?/g) ?? [],
    links: text.match(/\]\([^)]+\)/g) ?? [],
    inline: text.match(/`[^`\n]+`/g) ?? [],
    blocks: codeBlocks(src),
    headings: text.match(/^#{2,3} .+$/gm) ?? [],
  };
};
const bag = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const diff = (a, b) => {
  const A = bag(a);
  const B = bag(b);
  const out = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const d = (B.get(k) ?? 0) - (A.get(k) ?? 0);
    if (d) out.push(`${d > 0 ? '+' : ''}${d} ${k.slice(0, 60)}`);
  }
  return out;
};

let bad = 0;
for (const id of readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const path = `${dir}/${id}/Article.mdx`;
  let before;
  try {
    before = execFileSync('git', ['show', `${base}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    continue;
  }
  const after = readFileSync(path, 'utf8');
  if (before === after) continue;
  const a = extract(before);
  const b = extract(after);
  const issues = [];
  for (const key of ['numbers', 'links', 'inline']) {
    const d = diff(a[key], b[key]);
    if (d.length) issues.push(`${key}: ${d.join(' | ')}`);
  }
  if (a.blocks.join('\n') !== b.blocks.join('\n')) issues.push('code blocks changed');
  if (a.headings.join('\n') !== b.headings.join('\n')) issues.push('headings changed');
  if (issues.length) {
    bad++;
    console.log(`## ${id}\n  ${issues.join('\n  ')}`);
  }
}
console.log(bad ? `\n${bad} article(s) need review` : 'all fact elements preserved');
