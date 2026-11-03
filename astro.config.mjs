// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// GitHub Pages 배포 시: site는 https://<유저명>.github.io, base는 /<레포명>
// 다른 곳에 배포하면 SITE_URL, BASE_PATH 환경변수로 바꾸세요.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://wonby1n.github.io",
  base: process.env.BASE_PATH ?? "/cs-hanip",
  integrations: [react()],
});
