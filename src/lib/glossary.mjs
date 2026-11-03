// 용어 사전을 읽고, 마크다운 본문의 [[용어]] 를 툴팁 마크업으로 바꾸는 remark 플러그인.
// astro.config.mjs 에서 쓰기 때문에 순수 JS(.mjs)로 둔다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { visit } from "unist-util-visit";

const GLOSSARY_PATH = fileURLToPath(new URL("../../content/glossary.yml", import.meta.url));
export const TERM_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** 용어에 붙일 수 있는 태그. 순서대로 화면에 나온다. 새 태그가 필요하면 여기에 추가. */
export const TAGS = ["서버", "백엔드", "프론트엔드", "인프라", "네트워크", "운영체제", "DB", "자료구조", "알고리즘", "동시성", "보안"];

const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const BASE_OF = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };
/** 색인 순서: ㄱ ~ ㅎ, 그다음 영문 */
export const INDEX_KEYS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "A-Z"];

/** 용어의 첫 글자로 색인 키를 구한다. "스레드" → "ㅅ", "까다로움" → "ㄱ", "Redis" → "A-Z" */
export function indexKey(id) {
  const c = id.trim().charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {
    const cho = CHOSEONG[Math.floor((c - 0xac00) / 588)];
    return BASE_OF[cho] ?? cho;
  }
  return "A-Z";
}

/** @returns {Map<string, {id: string, en?: string, def: string, tags: string[]}>} */
export function loadGlossary() {
  const list = parse(readFileSync(GLOSSARY_PATH, "utf8")) ?? [];
  const map = new Map();
  for (const t of list) {
    if (!t?.id || !t?.def) throw new Error(`[용어 사전] id와 def는 필수예요: ${JSON.stringify(t)}`);
    if (map.has(t.id)) throw new Error(`[용어 사전] 중복된 용어: ${t.id}`);
    const tags = t.tags ?? [];
    if (!Array.isArray(tags) || tags.length === 0) throw new Error(`[용어 사전] "${t.id}" 에 tags 를 1개 이상 달아주세요.`);
    const bad = tags.filter((x) => !TAGS.includes(x));
    if (bad.length) throw new Error(`[용어 사전] "${t.id}" 의 태그 ${bad.join(", ")} 는 없는 태그예요. 쓸 수 있는 태그: ${TAGS.join(", ")}`);
    map.set(t.id, { ...t, tags });
  }
  return map;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function termHtml(term, label) {
  const en = term.en && term.en !== term.id ? ` <span class="term-en">${esc(term.en)}</span>` : "";
  const tags = term.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `<span class="term" tabindex="0">${esc(label)}<span class="term-pop" role="tooltip"><span class="term-head"><strong>${esc(term.id)}</strong>${en}</span><span class="term-def">${esc(term.def)}</span><span class="tags">${tags}</span></span></span>`;
}

/** 본문에서 쓰인 용어 id 목록 (등장 순서, 중복 제거) */
export function termsIn(markdown) {
  const seen = new Set();
  for (const m of markdown.matchAll(TERM_RE)) seen.add(m[1].trim());
  return [...seen];
}

/**
 * 굵은 글씨로 시작하는 문단(예: "**스레드 풀 고갈.** 서버는…")을 개념 카드로 표시한다.
 * 글쓴이는 평소처럼 마크다운만 쓰면 되고, 화면에서 제목+설명 박스로 보인다.
 */
export function remarkConceptBlocks() {
  return (tree) => {
    visit(tree, "paragraph", (node) => {
      if (node.children?.[0]?.type !== "strong") return;
      node.data = node.data ?? {};
      node.data.hProperties = { ...(node.data.hProperties ?? {}), className: ["concept"] };
    });
  };
}

export function remarkGlossary() {
  return (tree, file) => {
    const glossary = loadGlossary();
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes("[[")) return;
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(TERM_RE)) {
        const id = m[1].trim();
        const term = glossary.get(id);
        if (!term) {
          throw new Error(`[용어 사전] "${id}" 가 content/glossary.yml 에 없어요. (${file.path ?? "본문"}) 사전에 먼저 추가해주세요.`);
        }
        if (m.index > last) parts.push({ type: "text", value: node.value.slice(last, m.index) });
        parts.push({ type: "html", value: termHtml(term, (m[2] ?? m[1]).trim()) });
        last = m.index + m[0].length;
      }
      if (!parts.length) return;
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}
