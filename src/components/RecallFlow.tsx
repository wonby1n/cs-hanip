import { useEffect, useRef, useState } from "react";
import { AIError, chat, chatJSON, loadSettings } from "../lib/ai";
import { followupPrompt, gradePrompt, type Grade, type Level } from "../lib/prompts";
import { recordStudy } from "../lib/progress";

interface Props {
  slug: string;
  title: string;
  prompt: string;
  keyPoints: string[];
  followups: { q: string; answer: string }[];
  settingsHref: string;
}

type Step = "read" | "recall" | "follow" | "done";
const LEVEL_LABEL: Record<Level, string> = { good: "잘 꺼냈어요", partial: "절반 정도", miss: "다시 한 번" };
const DONE_MSG: Record<Level, string> = {
  good: "잘 설명했어요. 7일 뒤에 한 번만 다시 꺼내보면 오래 남아요.",
  partial: "뼈대는 잡혔어요. 3일 뒤에 빠진 부분까지 다시 설명해봐요.",
  miss: "괜찮아요, 원래 첫 회차는 이래요. 내일 다시 꺼내볼게요.",
};

/** 읽기 → 글 접고 설명 → 꼬리질문 → 복습 예약. 글 본문은 #article 요소로, 설명 단계에서 접는다. */
export default function RecallFlow({ slug, title, prompt, keyPoints, followups, settingsHref }: Props) {
  const [step, setStep] = useState<Step>("read");
  const [hasAI, setHasAI] = useState(false);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [checked, setChecked] = useState<boolean[]>(keyPoints.map(() => false));
  const [followQ, setFollowQ] = useState(followups[0].q);
  const [followA, setFollowA] = useState("");
  const [followFb, setFollowFb] = useState("");
  const [level, setLevel] = useState<Level>("partial");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => setHasAI(!!loadSettings()), []);
  useEffect(() => {
    const article = document.getElementById("article");
    if (article) article.hidden = step === "recall" || step === "follow";
  }, [step]);

  const fail = (e: unknown) => {
    if ((e as Error)?.name === "AbortError") return;
    setError(e instanceof AIError ? e.message : "알 수 없는 오류가 났어요.");
  };

  async function submitRecall() {
    if (!answer.trim()) return;
    setError("");
    if (!hasAI) return; // 수동 체크 UI가 대신 보인다
    setBusy(true);
    ctl.current = new AbortController();
    try {
      const g = await chatJSON<Grade>(gradePrompt(title, keyPoints, answer), ctl.current.signal);
      const lv: Level = ["good", "partial", "miss"].includes(g.level) ? g.level : "partial";
      setGrade({ ...g, level: lv });
      setLevel(lv);
      if (g.followup?.trim()) setFollowQ(g.followup);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  function submitManual() {
    const n = checked.filter(Boolean).length;
    const lv: Level = n >= Math.ceil(keyPoints.length * 0.8) ? "good" : n >= 2 ? "partial" : "miss";
    setLevel(lv);
    setStep("follow");
  }

  async function submitFollow() {
    if (!followA.trim()) return;
    setError("");
    if (!hasAI) {
      setFollowFb(followups.find((f) => f.q === followQ)?.answer ?? followups[0].answer);
      return;
    }
    setBusy(true);
    ctl.current = new AbortController();
    try {
      setFollowFb(await chat([{ role: "user", content: followupPrompt(followQ, followA) }], ctl.current.signal));
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  function finish() {
    recordStudy(slug, title, level);
    setStep("done");
    window.dispatchEvent(new Event("cs-hanip:progress"));
  }

  const steps: [Step, string][] = [["read", "1 읽기"], ["recall", "2 안 보고 설명"], ["follow", "3 꼬리질문"], ["done", "4 복습 예약"]];
  const idx = steps.findIndex(([s]) => s === step);

  return (
    <div className="flow">
      <ol className="steps" aria-label="학습 단계">
        {steps.map(([s, label], i) => (
          <li key={s} className={i === idx ? "on" : i < idx ? "done" : ""}>{label}</li>
        ))}
      </ol>

      {step === "read" && (
        <button className="btn" onClick={() => setStep("recall")}>다 읽었어요, 이제 안 보고 설명하기</button>
      )}

      {step === "recall" && (
        <section className="card">
          <div className="mono">Step 2 · 글은 접어뒀어요</div>
          <h3>{prompt}</h3>
          <textarea id="recall-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="떠오르는 대로 써보세요" />
          {!hasAI && answer.trim() && !grade && (
            <div className="fb">
              <p>AI를 연결하지 않아서 스스로 체크해요. 내 설명에 들어간 것에 체크하세요. <a href={settingsHref}>AI 연결하기</a></p>
              {keyPoints.map((k, i) => (
                <label key={k} className="check">
                  <input type="checkbox" id={`kp-${i}`} checked={checked[i]} onChange={() => setChecked(checked.map((c, j) => (j === i ? !c : c)))} />
                  {k}
                </label>
              ))}
              <button className="btn" onClick={submitManual}>체크 완료, 꼬리질문 받기</button>
            </div>
          )}
          {hasAI && !grade && (
            <div className="row">
              <button className="btn" disabled={busy || !answer.trim()} onClick={submitRecall}>{busy ? "읽는 중…" : "피드백 받기"}</button>
              {busy && <button className="btn ghost" onClick={() => ctl.current?.abort()}>멈추기</button>}
            </div>
          )}
          {grade && (
            <div className="fb">
              <span className={`verdict v-${grade.level}`}>{LEVEL_LABEL[grade.level]}</span>
              {grade.good?.length > 0 && (<><strong>좋았던 점</strong><ul>{grade.good.map((t) => <li key={t}>{t}</li>)}</ul></>)}
              {grade.missing?.length > 0 && (<><strong>채우면 좋을 점</strong><ul>{grade.missing.map((t) => <li key={t}>{t}</li>)}</ul></>)}
              <button className="btn" onClick={() => setStep("follow")}>꼬리질문 받기</button>
            </div>
          )}
          {error && <p className="err">{error}</p>}
        </section>
      )}

      {step === "follow" && (
        <section className="card">
          <div className="mono">Step 3 · 꼬리질문</div>
          <div className="followup"><span className="mono">면접관이라면</span>{followQ}</div>
          <textarea id="follow-answer" value={followA} onChange={(e) => setFollowA(e.target.value)} placeholder="떠오르는 대로 답해보세요" />
          {!followFb && (
            <div className="row">
              <button className="btn" disabled={busy || !followA.trim()} onClick={submitFollow}>{busy ? "생각하는 중…" : hasAI ? "답변 보내기" : "예시 답안 보기"}</button>
            </div>
          )}
          {followFb && (
            <div className="fb">
              {!hasAI && <strong>예시 답안</strong>}
              <p className="out">{followFb}</p>
              <button className="btn" onClick={finish}>복습 예약하기</button>
            </div>
          )}
          {error && <p className="err">{error}</p>}
        </section>
      )}

      {step === "done" && (
        <section className="card">
          <div className="mono">Step 4 · 복습 예약 완료</div>
          <p>{DONE_MSG[level]}</p>
        </section>
      )}
    </div>
  );
}
