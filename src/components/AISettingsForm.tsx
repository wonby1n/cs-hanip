import { useEffect, useState } from "react";
import { AIError, PROVIDERS, chat, clearSettings, loadSettings, saveSettings, type AISettings } from "../lib/ai";
import type { ProviderId } from "../lib/ai/types";

export default function AISettingsForm() {
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(PROVIDERS.anthropic.defaultModel);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const s = loadSettings();
    if (s) { setProvider(s.provider); setApiKey(s.apiKey); setModel(s.model); }
  }, []);

  function pick(p: ProviderId) {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
  }

  async function save() {
    const s: AISettings = { provider, apiKey: apiKey.trim(), model: model.trim() };
    if (!s.apiKey) { setStatus("API 키를 넣어주세요."); return; }
    saveSettings(s);
    setStatus("연결 확인 중…");
    try {
      await chat([{ role: "user", content: "연결 테스트예요. '좋아요' 한 단어로만 답해주세요." }]);
      setStatus("연결됐어요. 이제 피드백과 꼬리질문을 AI가 해줘요.");
    } catch (e) {
      setStatus(e instanceof AIError ? `저장은 했지만 연결 확인에 실패했어요: ${e.message}` : "연결 확인에 실패했어요.");
    }
  }

  function remove() {
    clearSettings();
    setApiKey("");
    setStatus("키를 지웠어요.");
  }

  const p = PROVIDERS[provider];
  return (
    <form className="card settings" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset>
        <legend>AI 회사</legend>
        <div className="row">
          {Object.values(PROVIDERS).map((x) => (
            <label key={x.id} className="check">
              <input type="radio" name="provider" id={`provider-${x.id}`} checked={provider === x.id} onChange={() => pick(x.id)} />
              {x.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="api-key">API 키 <a href={p.keyUrl} target="_blank" rel="noreferrer">키 발급받기</a></label>
      <input id="api-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
      <label htmlFor="model">모델 이름</label>
      <input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
      <p className="note">모델 이름은 각 회사가 자주 바꿔요. 안 되면 그 회사 문서에서 현재 이름을 확인해서 넣어주세요.</p>
      <div className="row">
        <button className="btn" type="submit">저장하고 연결 확인</button>
        <button className="btn ghost" type="button" onClick={remove}>키 지우기</button>
      </div>
      {status && <p className="note" role="status">{status}</p>}
    </form>
  );
}
