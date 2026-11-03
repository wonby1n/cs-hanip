// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { remarkConceptBlocks, remarkGlossary } from "./src/lib/glossary.mjs";

// GitHub Pages 배포 시: site는 https://<유저명>.github.io, base는 /<레포명>
// 다른 곳에 배포하면 SITE_URL, BASE_PATH 환경변수로 바꾸세요.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://wonby1n.github.io",
  base: process.env.BASE_PATH ?? "/cs-hanip",
  integrations: [react()],
  markdown: {
    // 본문의 [[용어]] → 툴팁 (사전에 없으면 빌드 실패), 굵은 글씨로 시작하는 문단 → 개념 카드
    remarkPlugins: [remarkConceptBlocks, remarkGlossary],
    // 코드 블록: 라이트/다크 테마 둘 다
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
