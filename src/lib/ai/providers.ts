import { AIError, type AISettings, type ChatMessage, type Provider } from "./types";

async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AIError("network", "AI 서버에 연결하지 못했어요.");
  }
  if (res.status === 401 || res.status === 403) throw new AIError("auth", "API 키가 맞지 않아요. 설정에서 확인해주세요.");
  if (res.status === 429) throw new AIError("rate_limited", "요청이 많거나 사용량 한도에 닿았어요. 잠시 뒤 다시 시도해주세요.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AIError("bad_response", `AI 응답 오류 (${res.status}) ${detail.slice(0, 200)}`);
  }
  return res.json();
}

const anthropic: Provider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  defaultModel: "claude-sonnet-5-5",
  keyUrl: "https://console.anthropic.com/settings/keys",
  async chat(messages: ChatMessage[], s: AISettings, signal?: AbortSignal) {
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": s.apiKey,
        "anthropic-version": "2023-06-01",
        // 브라우저에서 직접 호출할 때 필요한 헤더. 키가 사용자 본인 것이라 괜찮다.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      { model: s.model, max_tokens: 1024, messages },
      signal,
    );
    const text = data?.content?.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    if (!text) throw new AIError("bad_response", "빈 응답이 왔어요.");
    return text;
  },
};

const openai: Provider = {
  id: "openai",
  label: "OpenAI (GPT)",
  defaultModel: "gpt-4o-mini",
  keyUrl: "https://platform.openai.com/api-keys",
  async chat(messages, s, signal) {
    const data = await post(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${s.apiKey}` },
      { model: s.model, messages },
      signal,
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new AIError("bad_response", "빈 응답이 왔어요.");
    return text;
  },
};

const gemini: Provider = {
  id: "gemini",
  label: "Google (Gemini)",
  defaultModel: "gemini-2.0-flash",
  keyUrl: "https://aistudio.google.com/app/apikey",
  async chat(messages, s, signal) {
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
      { "x-goog-api-key": s.apiKey },
      { contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })) },
      signal,
    );
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) throw new AIError("bad_response", "빈 응답이 왔어요.");
    return text;
  },
};

export const PROVIDERS: Record<string, Provider> = { anthropic, openai, gemini };
