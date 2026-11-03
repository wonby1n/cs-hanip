import { useState } from "react";

/** 001호 시뮬레이터. 단순화한 모델: 서버 1대 초당 500건 처리, 3초 넘게 기다리면 실패. */
const ONE = 500, WIN = 10, TIMEOUT = 3;

export default function TrafficSim() {
  const [raw, setRaw] = useState(2000);
  const [scale, setScale] = useState(false);
  const [queue, setQueue] = useState(false);
  const [limit, setLimit] = useState(false);

  const cap = ONE * (scale ? 3 : 1);
  const r = Math.round(raw * (limit ? 0.7 : 1));
  const over = Math.max(0, r - cap);
  const backlog = over * WIN;
  const wait = backlog / cap;
  const fail = queue || r <= cap ? 0 : Math.min(99, Math.round((Math.max(0, wait - TIMEOUT) / wait) * 100));
  const state = r <= cap || queue ? "good" : fail > 0 ? "bad" : "warn";
  const say =
    r <= cap ? "여유 있어요. 들어오는 만큼 바로 처리하고 있어요."
    : queue ? "서버는 멀쩡해요. 대신 사용자가 순번을 기다려요. 이게 대기열의 거래예요."
    : fail > 0 ? "터졌어요. 밀린 요청이 시간 초과로 실패하고, 새로고침이 부하를 더 키워요."
    : "아슬아슬해요. 밀리긴 하는데 아직 시간 안에 처리되고 있어요.";

  return (
    <div className="sim">
      <label htmlFor="sim-rate">직접 만져보기: 요청을 올려서 터뜨린 다음, 해결책을 켜보세요</label>
      <input id="sim-rate" type="range" min={100} max={5000} step={100} value={raw} onChange={(e) => setRaw(+e.target.value)} />
      <div className="row">
        <label className="check"><input id="sim-scale" type="checkbox" checked={scale} onChange={() => setScale(!scale)} />서버 3대로 미리 늘리기</label>
        <label className="check"><input id="sim-queue" type="checkbox" checked={queue} onChange={() => setQueue(!queue)} />대기열 켜기</label>
        <label className="check"><input id="sim-limit" type="checkbox" checked={limit} onChange={() => setLimit(!limit)} />연타·매크로 제한 (30% 걸러냄)</label>
      </div>
      <div className="stats">
        <div className="stat"><div className="v">{(queue ? Math.min(r, cap) : r).toLocaleString()}</div><div className="l">서버에 닿는 초당 요청</div></div>
        <div className="stat"><div className="v">{backlog.toLocaleString()}</div><div className="l">{queue ? "대기실에 서 있는 사람" : "10초 뒤 밀린 요청"}</div></div>
        <div className="stat"><div className="v">{queue ? `${Math.round(wait)}초` : `${fail}%`}</div><div className="l">{queue ? "10초 뒤 예상 대기" : "시간 초과 비율"}</div></div>
      </div>
      <p className={`simsay s-${state}`}>{say}</p>
      <p className="note">단순화한 모델이에요: 서버 1대가 초당 500건 처리, 3초 넘게 기다린 요청은 실패로 쳐요.</p>
    </div>
  );
}
