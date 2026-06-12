import { readFile, writeFile } from "node:fs/promises";

const path = "src/data/pokemon.json";
const concurrency = 24;

const rows = JSON.parse(await readFile(path, "utf8"));
const pokemonDetails = new Map();
const abilityDetails = new Map();
let pokemonCursor = 0;
let abilityCursor = 0;

await Promise.all(Array.from({ length: concurrency }, () => pokemonWorker()));

const abilityUrls = [
  ...new Set(
    [...pokemonDetails.values()].flatMap((details) => details.abilities.map((entry) => entry.ability.url)),
  ),
];

console.log(`fetching ${abilityUrls.length} unique abilities`);
await Promise.all(Array.from({ length: concurrency }, () => abilityWorker(abilityUrls)));

rows.forEach((row) => {
  const details = pokemonDetails.get(row.dex);
  row.abilities = details.abilities
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => {
      const ability = abilityDetails.get(entry.ability.url);
      return {
        id: ability.name,
        name: ability.names.find((name) => name.language.name === "ko")?.name ?? toTitle(ability.name),
        description: abilityDescription(ability),
        isHidden: entry.is_hidden,
        slot: entry.slot,
      };
    });
});

await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`patched abilities for ${rows.length} Pokemon`);

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

async function abilityWorker(abilityUrls) {
  while (abilityCursor < abilityUrls.length) {
    const index = abilityCursor;
    abilityCursor += 1;
    const url = abilityUrls[index];
    abilityDetails.set(url, await getJson(url));

    if ((index + 1) % 50 === 0) {
      console.log(`fetched abilities ${index + 1}/${abilityUrls.length}`);
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

function abilityDescription(ability) {
  const koreanFlavor = ability.flavor_text_entries
    .filter((entry) => entry.language.name === "ko")
    .at(-1)?.flavor_text;
  if (koreanFlavor) return clean(koreanFlavor);

  const englishEffect = ability.effect_entries.find((entry) => entry.language.name === "en")?.short_effect;
  if (englishEffect) return clean(englishEffect);

  return "PokeAPI 기준 실제 보유 특성입니다. 전투 효과는 일부만 구현되어 있습니다.";
}

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitle(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}
