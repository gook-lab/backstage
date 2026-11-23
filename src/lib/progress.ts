import { useSyncExternalStore } from 'react';

/** 모듈별 체크한 항목 id. 이 기기 브라우저에만 남는다 */
export type Progress = Record<string, string[]>;

const KEY = 'backstage:progress-v1';
const listeners = new Set<() => void>();
let cache: Progress | null = null;

function read(): Progress {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Progress) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 시크릿 창 등에서 저장이 막혀도 이번 방문 동안은 화면에 남는다
  }
  listeners.forEach((l) => l());
}

export function toggleCheck(moduleId: string, itemId: string) {
  const current = read()[moduleId] ?? [];
  const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
  write({ ...read(), [moduleId]: next });
}

export function resetProgressCache() {
  cache = null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, read);
}

/** 체크리스트 중 몇 개를 했는지. 없는 항목 id 는 세지 않는다 */
export function doneCount(progress: Progress, moduleId: string, itemIds: string[]): number {
  const checked = new Set(progress[moduleId] ?? []);
  return itemIds.filter((id) => checked.has(id)).length;
}
