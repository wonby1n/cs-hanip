import { useEffect, useState } from "react";
import { dueCount, loadProgress, streak } from "../lib/progress";

export default function ProgressBadge() {
  const [s, setS] = useState({ streak: 0, due: 0 });
  useEffect(() => {
    const update = () => { const p = loadProgress(); setS({ streak: streak(p), due: dueCount(p) }); };
    update();
    window.addEventListener("cs-hanip:progress", update);
    return () => window.removeEventListener("cs-hanip:progress", update);
  }, []);
  return (
    <div className="badge" aria-label="학습 기록">
      <span>연속 <b>{s.streak}</b>일</span>
      <span>복습 대기 <b>{s.due}</b>개</span>
    </div>
  );
}
