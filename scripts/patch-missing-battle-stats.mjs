import { readFile, writeFile } from "node:fs/promises";

const path = "src/data/pokemon.json";
const rows = JSON.parse(await readFile(path, "utf8"));
const concurrency = 24;
let cursor = 0;

async function worker() {
  while (cursor < rows.length) {
    const index = cursor;
    cursor += 1;
    const row = rows[index];
    const details = await getJson(`https://pokeapi.co/api/v2/pokemon/${row.dex}/`);
    const stats = Object.fromEntries(details.stats.map((entry) => [entry.stat.name, entry.base_stat]));
    row.hp = stats.hp;
    row.attack = stats.attack;
    row.defense = stats.defense;
    row.specialAttack = stats["special-attack"];
    row.specialDefense = stats["special-defense"];
    row.speed = stats.speed;

    if ((index + 1) % 100 === 0) {
      console.log(`patched ${index + 1}/${rows.length}`);
    }
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  return response.json();
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`patched battle stats for ${rows.length} Pokemon`);
