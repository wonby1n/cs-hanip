/**
 * 채점·꼬리질문 프롬프트. 품질을 바꾸고 싶으면 여기만 고치면 된다.
 * 프롬프트를 고치는 PR에는 "바꾸기 전/후 같은 답변에 대한 결과"를 첨부해주세요.
 */

export type Level = "good" | "partial" | "miss";

export interface Grade {
  level: Level;
  good: string[];
  missing: string[];
  followup: string;
}

export function gradePrompt(topic: string, keyPoints: string[], answer: string): string {
  return `너는 신입 개발자 CS 면접을 돕는 친절한 코치야. 한국어 존댓말(~요체)로 짧게.
주제: ${topic}
좋은 답변의 핵심 포인트: ${keyPoints.join(" / ")}
학습자가 글을 안 보고 쓴 설명:
"""${answer.slice(0, 2000)}"""
평가 기준: 원리를 자기 말로 이해했는지. 용어를 몰라도 원리가 맞으면 인정해. 틀린 내용이 있으면 반드시 짚어줘.
JSON 하나로만 답해:
{"level":"good"|"partial"|"miss","good":["잘한 점 1~2개"],"missing":["빠졌거나 틀린 점 0~2개"],"followup":"학습자 설명에서 이어지는, 실제 면접관이 할 법한 꼬리질문 1개"}`;
}

export function followupPrompt(question: string, answer: string): string {
  return `너는 신입 개발자 CS 면접 코치야. 한국어 존댓말(~요체), 마크다운 기호 없이 평문.
면접 질문: ${question}
지원자 답변: """${answer.slice(0, 2000)}"""
5~7문장 안으로: 맞은 부분 → 틀리거나 부족한 부분 → 면접에서 이렇게 말하면 좋은 모범 답변 2~3문장(실제 해결 방법까지).`;
}

/** 복습 간격: 잘했으면 7일, 절반이면 3일, 못했으면 내일 */
export const REVIEW_GAP_DAYS: Record<Level, number> = { good: 7, partial: 3, miss: 1 };
