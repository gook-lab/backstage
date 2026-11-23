import { useEffect, useMemo, useState, type RefObject } from 'react';

interface Heading {
  id: string;
  text: string;
}

const slug = (text: string, i: number) => `s-${i}-${text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;

/** 글(MDX)은 늦게 불러오므로 본문이 바뀔 때마다 h2 를 다시 모은다 */
function useHeadings(root: RefObject<HTMLElement | null>) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const collect = () => {
      const next = [...el.querySelectorAll('h2')].map((h, i) => {
        if (!h.id) h.id = slug(h.textContent ?? '', i);
        return { id: h.id, text: h.textContent ?? '' };
      });
      setHeadings((prev) => (prev.length === next.length && prev.every((p, i) => p.id === next[i].id) ? prev : next));
    };
    collect();
    const mo = new MutationObserver(collect);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [root]);
  return headings;
}

/** 화면 위쪽 기준선을 이미 지난 마지막 제목이 지금 읽는 절이다 */
function useActive(ids: string[]) {
  const [active, setActive] = useState<string | undefined>();
  useEffect(() => {
    if (ids.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current: string | undefined;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

export function Toc({ root }: { root: RefObject<HTMLElement | null> }) {
  const headings = useHeadings(root);
  const ids = useMemo(() => headings.map((h) => h.id), [headings]);
  const active = useActive(ids);
  if (headings.length === 0) return null;
  return (
    <nav className="toc" aria-label="이 글의 목차">
      <p className="toc__title">이 글에서</p>
      <ol>
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} aria-current={active === h.id ? 'location' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
