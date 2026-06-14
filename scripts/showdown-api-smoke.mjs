import { spawn } from "node:child_process";
import pokemonRows from "../src/data/pokemon.json" with { type: "json" };

const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/showdown-service.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

function pickTeam(names) {
  return names.map((name) => {
    const mon = pokemonRows.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (!mon) throw new Error(`Pokemon not found: ${name}`);
    return mon;
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Showdown API did not become healthy");
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

try {
  const health = await waitForHealth();
  const start = await postJson("/battle/start", {
    team: pickTeam(["Shedinja", "Pikachu", "Charizard", "Gengar", "Snorlax", "Dragonite"]),
    enemy: pickTeam(["Machamp", "Raichu", "Venusaur", "Blastoise", "Golem", "Alakazam"]),
    seed: [1, 2, 3, 4],
  });
  const turn = await postJson(`/battle/${start.battleId}/player-action`, { choice: "move 1" });

  console.log(
    JSON.stringify(
      {
        ok: true,
        health,
        battleId: start.battleId,
        startChunks: start.chunks.length,
        turnChunks: turn.chunks.length,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
