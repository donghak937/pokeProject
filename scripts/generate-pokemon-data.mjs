import { mkdir, writeFile } from "node:fs/promises";

const generationIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
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

const markFallback = "?";

async function main() {
  const speciesById = new Map();

  for (const generationId of generationIds) {
    const generation = await getJson(`https://pokeapi.co/api/v2/generation/${generationId}/`);
    for (const speciesRef of generation.pokemon_species) {
      const id = Number(speciesRef.url.match(/pokemon-species\/(\d+)\//)?.[1]);
      if (!Number.isFinite(id)) continue;
      speciesById.set(id, { id, generation: generationId, url: speciesRef.url });
    }
  }

  const rows = [];
  const sortedSpecies = [...speciesById.values()].sort((a, b) => a.id - b.id);

  for (const speciesRef of sortedSpecies) {
    const species = await getJson(speciesRef.url);
    const defaultVariety = species.varieties.find((variety) => variety.is_default) ?? species.varieties[0];
    const details = await getJson(defaultVariety.pokemon.url);
    const name = toTitle(defaultVariety.pokemon.name);
    const koreanName = species.names.find((entry) => entry.language.name === "ko")?.name ?? name;
    const stats = Object.fromEntries(details.stats.map((entry) => [entry.stat.name, entry.base_stat]));
    const types = details.types
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => typeMap[entry.type.name])
      .filter(Boolean);

    rows.push({
      name,
      displayName: koreanName,
      dex: species.id,
      gen: speciesRef.generation,
      types,
      total: details.stats.reduce((sum, entry) => sum + entry.base_stat, 0),
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      mark: koreanName.slice(0, 1) || markFallback,
      score: 0,
      spriteUrl: `/pokemon-sprites/${species.id}.png`,
    });

    if (rows.length % 100 === 0) {
      console.log(`generated ${rows.length}/${sortedSpecies.length}`);
    }
  }

  await mkdir("src/data", { recursive: true });
  await writeFile("src/data/pokemon.json", `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`wrote ${rows.length} Pokemon`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  return response.json();
}

function toTitle(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
