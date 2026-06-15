import { readFile, writeFile } from "node:fs/promises";

const path = "src/data/pokemon.json";
const concurrency = 24;
const typeMap = {
  normal: "Normal",
  fire: "Fire",
  water: "Water",
  grass: "Grass",
  electric: "Electric",
  ice: "Ice",
  fighting: "Fighting",
  poison: "Poison",
  ground: "Ground",
  flying: "Flying",
  psychic: "Psychic",
  bug: "Bug",
  rock: "Rock",
  ghost: "Ghost",
  dragon: "Dragon",
  dark: "Dark",
  steel: "Steel",
  fairy: "Fairy",
};

const rows = JSON.parse(await readFile(path, "utf8"));
const pokemonDetails = new Map();
const moveDetails = new Map();
let pokemonCursor = 0;
let moveCursor = 0;

await Promise.all(Array.from({ length: concurrency }, () => pokemonWorker()));

const moveUrls = [
  ...new Set(
    [...pokemonDetails.values()].flatMap((details) => details.moves.map((entry) => entry.move.url)),
  ),
];

console.log(`fetching ${moveUrls.length} unique moves`);
await Promise.all(Array.from({ length: concurrency }, () => moveWorker(moveUrls)));

rows.forEach((row) => {
  const details = pokemonDetails.get(row.dex);
  const movePool = details.moves
    .map((entry) => moveDetails.get(entry.move.url))
    .filter(Boolean)
    .filter((move) => typeMap[move.type.name])
    .map((move) => ({
      name: toTitle(move.name),
      displayName: move.names.find((entry) => entry.language.name === "ko")?.name ?? toTitle(move.name),
      type: typeMap[move.type.name],
      category: move.damage_class.name,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      target: move.target.name,
      drain: move.meta?.drain && move.meta.drain > 0 ? move.meta.drain : undefined,
      statChanges: move.stat_changes.map((entry) => ({
        stat: entry.stat.name,
        change: entry.change,
      })),
    }))
    .filter((move, index, pool) => pool.findIndex((item) => item.name === move.name) === index)
    .sort((a, b) => moveRank(b) - moveRank(a));

  row.movePool = movePool;
});

await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`patched move pools for ${rows.length} Pokemon`);

async function pokemonWorker() {
  while (pokemonCursor < rows.length) {
    const index = pokemonCursor;
    pokemonCursor += 1;
    const row = rows[index];
    pokemonDetails.set(row.dex, await getJson(`https://pokeapi.co/api/v2/pokemon/${row.dex}/`));

    if ((index + 1) % 100 === 0) {
      console.log(`fetched pokemon ${index + 1}/${rows.length}`);
    }
  }
}

async function moveWorker(moveUrls) {
  while (moveCursor < moveUrls.length) {
    const index = moveCursor;
    moveCursor += 1;
    const url = moveUrls[index];
    moveDetails.set(url, await getJson(url));

    if ((index + 1) % 100 === 0) {
      console.log(`fetched moves ${index + 1}/${moveUrls.length}`);
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

function moveRank(move) {
  const power = move.power ?? 0;
  const accuracy = move.accuracy ?? 100;
  const categoryBonus = move.category === "status" ? 15 : 0;
  return power * (accuracy / 100) + categoryBonus + (move.pp ?? 0) * 0.2;
}

function toTitle(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}
