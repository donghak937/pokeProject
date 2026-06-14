import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error The dev-only Showdown middleware is plain ESM.
import { createShowdownHandler } from "./scripts/showdown-http.mjs";

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
  plugins: [
    react(),
    {
      name: "pokeproject-showdown-api",
      configureServer(server) {
        const handleShowdownRequest = createShowdownHandler();
        server.middlewares.use("/api", (req, res) => {
          void handleShowdownRequest(req, res, { basePath: "/api" });
        });
      },
    },
  ],
});
