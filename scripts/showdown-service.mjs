import { createServer } from "node:http";
import { createShowdownHandler } from "./showdown-http.mjs";

const port = Number.parseInt(process.env.PORT ?? process.env.SHOWDOWN_PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const handleShowdownRequest = createShowdownHandler();

const server = createServer(async (req, res) => {
  await handleShowdownRequest(req, res);
});

server.listen(port, host, () => {
  console.log(`Pokemon Showdown service listening on http://${host}:${port}`);
});
