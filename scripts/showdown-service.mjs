import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createShowdownBattle, waitForChunks } from "./showdown-adapter.mjs";

const port = Number.parseInt(process.env.SHOWDOWN_PORT ?? "8787", 10);
const battles = new Map();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function assertTeams(body) {
  if (!Array.isArray(body.team) || !Array.isArray(body.enemy)) {
    throw new Error("team and enemy arrays are required");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, battles: battles.size });
      return;
    }

    if (req.method === "POST" && url.pathname === "/battle/start") {
      const body = await readBody(req);
      assertTeams(body);

      const battleId = randomUUID();
      const battle = createShowdownBattle(body);
      battles.set(battleId, battle);

      battle.write(">p1 team 123456");
      battle.write(">p2 team 123456");
      await waitForChunks(100);

      sendJson(res, 200, { battleId, chunks: battle.snapshot() });
      return;
    }

    const choiceMatch = url.pathname.match(/^\/battle\/([^/]+)\/choose$/);
    if (req.method === "POST" && choiceMatch) {
      const battle = battles.get(choiceMatch[1]);
      if (!battle) {
        sendJson(res, 404, { error: "battle not found" });
        return;
      }

      const body = await readBody(req);
      if (typeof body.side !== "string" || typeof body.choice !== "string") {
        sendJson(res, 400, { error: "side and choice are required" });
        return;
      }

      battle.write(`>${body.side} ${body.choice}`);
      await waitForChunks(100);
      sendJson(res, 200, { battleId: choiceMatch[1], chunks: battle.snapshot() });
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pokemon Showdown service listening on http://127.0.0.1:${port}`);
});
