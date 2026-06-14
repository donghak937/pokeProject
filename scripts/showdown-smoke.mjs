import pokemonRows from "../src/data/pokemon.json" with { type: "json" };
import { createShowdownBattle, waitForChunks } from "./showdown-adapter.mjs";

function pickTeam(names) {
  return names.map((name) => {
    const mon = pokemonRows.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (!mon) throw new Error(`Pokemon not found: ${name}`);
    return mon;
  });
}

const p1 = pickTeam(["Shedinja", "Pikachu", "Charizard", "Gengar", "Snorlax", "Dragonite"]);
const p2 = pickTeam(["Machamp", "Raichu", "Venusaur", "Blastoise", "Golem", "Alakazam"]);
const battle = createShowdownBattle({ team: p1, enemy: p2, seed: [1, 2, 3, 4] });

battle.write(`>p1 team 123456`);
battle.write(`>p2 team 123456`);
battle.write(`>p1 move 1`);
battle.write(`>p2 move 1`);

await waitForChunks(1000);
console.log(battle.snapshot().join("\n---chunk---\n"));
