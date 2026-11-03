import { REVIEW_GAP_DAYS, type Level } from "./prompts";

/** 학습 기록은 사용자 브라우저에만 저장한다. 서버도 계정도 없다. */
const KEY = "cs-hanip:progress";

export interface Progress {
  days: string[];
  reviews: { slug: string; title: string; due: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Progress) : { days: [], reviews: [] };
  } catch {
    return { days: [], reviews: [] };
  }
}

export function recordStudy(slug: string, title: string, level: Level): Progress {
  const p = loadProgress();
  if (!p.days.includes(today())) p.days.push(today());
  const due = new Date();
  due.setDate(due.getDate() + REVIEW_GAP_DAYS[level]);
  p.reviews = p.reviews.filter((r) => r.slug !== slug);
  p.reviews.push({ slug, title, due: due.toISOString().slice(0, 10) });
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
  return p;
}

export function streak(p: Progress): number {
  const set = new Set(p.days);
  const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const dueCount = (p: Progress) => p.reviews.filter((r) => r.due <= today()).length;
