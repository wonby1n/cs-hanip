import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * 뉴스레터 한 호 = content/issues/ 아래 마크다운 파일 하나.
 * 이 스키마를 통과하지 못하면 빌드가 실패하므로, 기여자는 templates/issue-template.md 를 복사해서 시작한다.
 */
const issues = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/issues" }),
  schema: z.object({
    no: z.number().int().positive(),
    title: z.string(),
    category: z.array(z.enum(["네트워크", "운영체제", "데이터베이스", "자료구조", "알고리즘", "보안", "동시성", "시스템설계", "웹"])).min(1),
    date: z.coerce.date(),
    summary: z.string().describe("한 줄 요약. 굵게 표시된다."),
    // 안 보고 설명하기 단계
    recall: z.object({
      prompt: z.string(),
      keyPoints: z.array(z.string()).min(2).max(6),
    }),
    // 꼬리질문. AI를 연결하지 않은 사람에게는 이 질문과 예시 답안이 그대로 나온다.
    followups: z.array(z.object({ q: z.string(), answer: z.string() })).min(1),
    // 이 호에 붙일 인터랙티브 시뮬레이터 이름 (src/components/sims/index.ts 에 등록)
    sim: z.string().optional(),
    // 면접에 실제로 나왔다는 근거. 출처 없는 '기출'은 받지 않는다.
    seenIn: z.array(z.object({ company: z.string(), year: z.number(), source: z.string().url() })).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1),
    authors: z.array(z.string()).min(1),
    reviewers: z.array(z.string()).default([]),
  }),
});

export const collections = { issues };
