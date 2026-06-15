import { randomUUID } from "node:crypto";
import { createShowdownBattle, waitForChunks } from "./showdown-adapter.mjs";

const maxBodyBytes = 1_000_000;
const battleTtlMs = 1000 * 60 * 60;

export function createShowdownHandler() {
  const battles = new Map();

  function now() {
    return Date.now();
  }

  function pruneBattles() {
    const cutoff = now() - battleTtlMs;
    for (const [battleId, battle] of battles.entries()) {
      if (battle.updatedAt < cutoff) battles.delete(battleId);
    }
  }

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
        if (body.length + chunk.length > maxBodyBytes) {
          reject(new Error("request body too large"));
          req.destroy();
          return;
        }
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
    if (body.team.length > 6 || body.enemy.length > 6) {
      throw new Error("team and enemy must have at most 6 Pokemon");
    }
  }

  function latestRequest(chunks, side) {
    for (let index = chunks.length - 1; index >= 0; index -= 1) {
      const lines = chunks[index].split("\n");
      if (lines[0] !== "sideupdate" || lines[1] !== side) continue;

      const requestLine = lines.find((line) => line.startsWith("|request|"));
      if (!requestLine) continue;

      try {
        return JSON.parse(requestLine.slice("|request|".length));
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  function firstAvailableSwitch(request) {
    const pokemon = request?.side?.pokemon ?? [];
    const switchIndex = pokemon.findIndex((mon) => !mon.active && !String(mon.condition ?? "").includes("fnt"));
    return switchIndex >= 0 ? `switch ${switchIndex + 1}` : undefined;
  }

  function firstLegalChoice(request) {
    if (!request || request.wait) return undefined;
    if (request.forceSwitch?.[0]) return firstAvailableSwitch(request);

    const active = request.active?.[0];
    if (!active) return undefined;

    const moveIndex = active.moves?.findIndex((move) => !move.disabled);
    if (moveIndex >= 0) return `move ${moveIndex + 1}`;
    return firstAvailableSwitch(request);
  }

  async function applyAutoChoice(entry, side) {
    const request = latestRequest(entry.battle.snapshot(), side);
    const choice = firstLegalChoice(request);
    if (!choice) return undefined;

    entry.battle.write(`>${side} ${choice}`);
    await waitForChunks(100);
    entry.updatedAt = now();
    return choice;
  }

  async function applyOpponentChoices(entry) {
    const choices = [];

    for (let index = 0; index < 3; index += 1) {
      const request = latestRequest(entry.battle.snapshot(), "p2");
      const choice = firstLegalChoice(request);
      if (!choice) break;

      entry.battle.write(`>p2 ${choice}`);
      await waitForChunks(100);
      entry.updatedAt = now();
      choices.push(choice);

      if (!request?.forceSwitch?.[0]) break;
    }

    return choices;
  }

  return async function handleShowdownRequest(req, res, options = {}) {
    try {
      pruneBattles();

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return true;
      }

      const basePath = options.basePath ?? "";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathname = basePath && url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) || "/" : url.pathname;

      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true, battles: battles.size, engine: "pokemon-showdown" });
        return true;
      }

      if (req.method === "GET" && pathname === "/") {
        sendJson(res, 200, {
          ok: true,
          name: "PokeProject Showdown API",
          routes: ["GET /health", "POST /battle/start", "GET /battle/:id", "POST /battle/:id/choose", "POST /battle/:id/player-action"],
        });
        return true;
      }

      if (req.method === "POST" && pathname === "/battle/start") {
        const body = await readBody(req);
        assertTeams(body);

        const battleId = randomUUID();
        const battle = createShowdownBattle(body);
        battles.set(battleId, { battle, createdAt: now(), updatedAt: now() });

        battle.write(">p1 team 123456");
        battle.write(">p2 team 123456");
        await waitForChunks(100);

        sendJson(res, 200, { battleId, chunks: battle.snapshot() });
        return true;
      }

      const stateMatch = pathname.match(/^\/battle\/([^/]+)$/);
      if (req.method === "GET" && stateMatch) {
        const entry = battles.get(stateMatch[1]);
        if (!entry) {
          sendJson(res, 404, { error: "battle not found" });
          return true;
        }

        entry.updatedAt = now();
        sendJson(res, 200, { battleId: stateMatch[1], chunks: entry.battle.snapshot() });
        return true;
      }

      const choiceMatch = pathname.match(/^\/battle\/([^/]+)\/choose$/);
      if (req.method === "POST" && choiceMatch) {
        const entry = battles.get(choiceMatch[1]);
        if (!entry) {
          sendJson(res, 404, { error: "battle not found" });
          return true;
        }

        const body = await readBody(req);
        if (typeof body.side !== "string" || typeof body.choice !== "string") {
          sendJson(res, 400, { error: "side and choice are required" });
          return true;
        }

        if (body.side !== "p1" && body.side !== "p2") {
          sendJson(res, 400, { error: "side must be p1 or p2" });
          return true;
        }

        entry.battle.write(`>${body.side} ${body.choice}`);
        await waitForChunks(100);
        entry.updatedAt = now();
        sendJson(res, 200, { battleId: choiceMatch[1], chunks: entry.battle.snapshot() });
        return true;
      }

      const playerActionMatch = pathname.match(/^\/battle\/([^/]+)\/player-action$/);
      if (req.method === "POST" && playerActionMatch) {
        const entry = battles.get(playerActionMatch[1]);
        if (!entry) {
          sendJson(res, 404, { error: "battle not found" });
          return true;
        }

        const body = await readBody(req);
        if (typeof body.choice !== "string") {
          sendJson(res, 400, { error: "choice is required" });
          return true;
        }

      entry.battle.write(`>p1 ${body.choice}`);
      await waitForChunks(100);
      const enemyChoices = await applyOpponentChoices(entry);
      sendJson(res, 200, { battleId: playerActionMatch[1], enemyChoice: enemyChoices[0], enemyChoices, chunks: entry.battle.snapshot() });
      return true;
    }

      sendJson(res, 404, { error: "not found" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
