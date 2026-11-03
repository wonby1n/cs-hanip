import type { ComponentType } from "react";
import TrafficSim from "./TrafficSim";

/**
 * 시뮬레이터 등록표. 콘텐츠 frontmatter의 `sim: traffic` 이 여기 키와 매칭된다.
 * 새 시뮬레이터: sims/MySim.tsx 를 만들고 아래에 한 줄 추가.
 */
export const SIMS: Record<string, ComponentType> = {
  traffic: TrafficSim,
};
