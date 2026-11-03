/**
 * BYOK(Bring Your Own Key) AI 레이어.
 * 키는 사용자 브라우저(localStorage)에만 저장되고, 요청은 브라우저에서 각 AI 회사 API로 바로 간다.
 * 이 프로젝트의 서버는 키를 절대 보지 않는다. (서버 자체가 없는 정적 사이트)
 */

export type ProviderId = "anthropic" | "openai" | "gemini";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AISettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** 설정 화면에 미리 채워두는 모델 이름. 각 회사가 이름을 자주 바꾸니 사용자가 고칠 수 있다. */
  defaultModel: string;
  keyUrl: string;
  chat(messages: ChatMessage[], settings: AISettings, signal?: AbortSignal): Promise<string>;
}

export class AIError extends Error {
  constructor(
    public code: "no_key" | "auth" | "rate_limited" | "bad_response" | "network",
    message: string,
  ) {
    super(message);
  }
}
