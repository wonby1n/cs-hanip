import { SIMS } from "./index";

/** Astro는 하이드레이션할 컴포넌트를 정적으로 import해야 해서, 이름으로 고르는 래퍼를 둔다. */
export default function SimHost({ name }: { name: string }) {
  const Sim = SIMS[name];
  if (!Sim) return <p className="note">시뮬레이터 "{name}"를 찾지 못했어요. src/components/sims/index.ts 에 등록했는지 확인해주세요.</p>;
  return <Sim />;
}
