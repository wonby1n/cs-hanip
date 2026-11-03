import { PROVIDERS } from "./providers";
import { AIError, type AISettings, type ChatMessage } from "./types";

export { PROVIDERS, AIError };
export type { AISettings, ChatMessage };

const KEY = "cs-hanip:ai";

export function loadSettings(): AISettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AISettings;
    return s.apiKey ? s : null;
  } catch {
    return null;
  }
}

export function saveSettings(s: AISettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
}

export function clearSettings() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export async function chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const s = loadSettings();
  if (!s) throw new AIError("no_key", "AI를 연결하지 않았어요.");
  const p = PROVIDERS[s.provider];
  if (!p) throw new AIError("no_key", "알 수 없는 AI 제공자예요.");
  return p.chat(messages, s, signal);
}

/** 모델이 JSON 앞뒤에 말을 붙이거나 코드펜스로 감싸도 읽어낸다. */
export async function chatJSON<T>(prompt: string, signal?: AbortSignal): Promise<T> {
  const text = await chat([{ role: "user", content: prompt }], signal);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(Math.min(...["{", "["].map((c) => text.indexOf(c)).filter((i) => i >= 0)), Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")) + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new AIError("bad_response", "AI 답변 형식이 꼬였어요. 다시 시도해주세요.");
  }
}
