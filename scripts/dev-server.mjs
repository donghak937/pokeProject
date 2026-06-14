import { createServer } from "vite";

const server = await createServer({
  configFile: "vite.config.ts",
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});

await server.listen();
server.printUrls();

setInterval(() => {}, 1 << 30);
