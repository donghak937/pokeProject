import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: {
    GITHUB_ACTIONS?: string;
    GITHUB_REPOSITORY?: string;
  };
};

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBase = process.env.GITHUB_ACTIONS && repoName && !repoName.endsWith(".github.io") ? `/${repoName}/` : "/";

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
});
