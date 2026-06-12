export const typeColors = {
  Normal: "#c7c1ad",
  Fire: "#ff9b54",
  Water: "#63b3ff",
  Grass: "#73d87a",
  Electric: "#ffd84d",
  Ice: "#9ce7ef",
  Fighting: "#e56b6f",
  Poison: "#c77dff",
  Ground: "#ddb36a",
  Flying: "#a6c8ff",
  Psychic: "#ff8fba",
  Bug: "#bdd957",
  Rock: "#c7aa68",
  Ghost: "#8d80d8",
  Dragon: "#8ea2ff",
  Dark: "#8b8179",
  Steel: "#b6c4d2",
  Fairy: "#ffb3dd",
} as const;

export type TypeName = keyof typeof typeColors;
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Pokemon = {
  name: string;
  gen: Generation;
  types: TypeName[];
  total: number;
  hp: number;
  attack: number;
  defense: number;
  mark: string;
  score: number;
  spriteUrl?: string;
};

export type DraftRule = {
  gen: Generation;
  type: TypeName;
};

export type MatchResult =
  | { round: string; skipped: true }
  | {
      round: string;
      skipped?: false;
      enemy: Pokemon[];
      playerScore: number;
      enemyScore: number;
      win: boolean;
    };

export const generationLabels: Record<Generation, string> = {
  1: "Kanto",
  2: "Johto",
  3: "Hoenn",
  4: "Sinnoh",
  5: "Unova",
  6: "Kalos",
  7: "Alola",
  8: "Galar",
  9: "Paldea",
};

const seedPokemon = [
  p("Venusaur", 1, ["Grass", "Poison"], 525, 80, 82, 83, "V"),
  p("Charizard", 1, ["Fire", "Flying"], 534, 78, 84, 78, "C"),
  p("Blastoise", 1, ["Water"], 530, 79, 83, 100, "B"),
  p("Pikachu", 1, ["Electric"], 320, 35, 55, 40, "P"),
  p("Gengar", 1, ["Ghost", "Poison"], 500, 60, 65, 60, "G"),
  p("Dragonite", 1, ["Dragon", "Flying"], 600, 91, 134, 95, "D"),
  p("Mewtwo", 1, ["Psychic"], 680, 106, 110, 90, "M"),
  p("Snorlax", 1, ["Normal"], 540, 160, 110, 65, "S"),
  p("Scizor", 2, ["Bug", "Steel"], 500, 70, 130, 100, "S"),
  p("Tyranitar", 2, ["Rock", "Dark"], 600, 100, 134, 110, "T"),
  p("Lugia", 2, ["Psychic", "Flying"], 680, 106, 90, 130, "L"),
  p("Ho-Oh", 2, ["Fire", "Flying"], 680, 106, 130, 90, "H"),
  p("Heracross", 2, ["Bug", "Fighting"], 500, 80, 125, 75, "H"),
  p("Kingdra", 2, ["Water", "Dragon"], 540, 75, 95, 95, "K"),
  p("Sceptile", 3, ["Grass"], 530, 70, 85, 65, "S"),
  p("Blaziken", 3, ["Fire", "Fighting"], 530, 80, 120, 70, "B"),
  p("Swampert", 3, ["Water", "Ground"], 535, 100, 110, 90, "S"),
  p("Gardevoir", 3, ["Psychic", "Fairy"], 518, 68, 65, 65, "G"),
  p("Metagross", 3, ["Steel", "Psychic"], 600, 80, 135, 130, "M"),
  p("Rayquaza", 3, ["Dragon", "Flying"], 680, 105, 150, 90, "R"),
  p("Torterra", 4, ["Grass", "Ground"], 525, 95, 109, 105, "T"),
  p("Infernape", 4, ["Fire", "Fighting"], 534, 76, 104, 71, "I"),
  p("Empoleon", 4, ["Water", "Steel"], 530, 84, 86, 88, "E"),
  p("Garchomp", 4, ["Dragon", "Ground"], 600, 108, 130, 95, "G"),
  p("Lucario", 4, ["Fighting", "Steel"], 525, 70, 110, 70, "L"),
  p("Darkrai", 4, ["Dark"], 600, 70, 90, 90, "D"),
  p("Serperior", 5, ["Grass"], 528, 75, 75, 95, "S"),
  p("Emboar", 5, ["Fire", "Fighting"], 528, 110, 123, 65, "E"),
  p("Samurott", 5, ["Water"], 528, 95, 100, 85, "S"),
  p("Zoroark", 5, ["Dark"], 510, 60, 105, 60, "Z"),
  p("Volcarona", 5, ["Bug", "Fire"], 550, 85, 60, 65, "V"),
  p("Hydreigon", 5, ["Dark", "Dragon"], 600, 92, 105, 90, "H"),
  p("Chesnaught", 6, ["Grass", "Fighting"], 530, 88, 107, 122, "C"),
  p("Delphox", 6, ["Fire", "Psychic"], 534, 75, 69, 72, "D"),
  p("Greninja", 6, ["Water", "Dark"], 530, 72, 95, 67, "G"),
  p("Talonflame", 6, ["Fire", "Flying"], 499, 78, 81, 71, "T"),
  p("Aegislash", 6, ["Steel", "Ghost"], 520, 60, 50, 140, "A"),
  p("Xerneas", 6, ["Fairy"], 680, 126, 131, 95, "X"),
  p("Decidueye", 7, ["Grass", "Ghost"], 530, 78, 107, 75, "D"),
  p("Incineroar", 7, ["Fire", "Dark"], 530, 95, 115, 90, "I"),
  p("Primarina", 7, ["Water", "Fairy"], 530, 80, 74, 74, "P"),
  p("Mimikyu", 7, ["Ghost", "Fairy"], 476, 55, 90, 80, "M"),
  p("Kommo-o", 7, ["Dragon", "Fighting"], 600, 75, 110, 125, "K"),
  p("Solgaleo", 7, ["Psychic", "Steel"], 680, 137, 137, 107, "S"),
  p("Rillaboom", 8, ["Grass"], 530, 100, 125, 90, "R"),
  p("Cinderace", 8, ["Fire"], 530, 80, 116, 75, "C"),
  p("Inteleon", 8, ["Water"], 530, 70, 85, 65, "I"),
  p("Corviknight", 8, ["Flying", "Steel"], 495, 98, 87, 105, "C"),
  p("Dragapult", 8, ["Dragon", "Ghost"], 600, 88, 120, 75, "D"),
  p("Zacian", 8, ["Fairy", "Steel"], 670, 92, 130, 115, "Z"),
  p("Meowscarada", 9, ["Grass", "Dark"], 530, 76, 110, 70, "M"),
  p("Skeledirge", 9, ["Fire", "Ghost"], 530, 104, 75, 100, "S"),
  p("Quaquaval", 9, ["Water", "Fighting"], 530, 85, 120, 80, "Q"),
  p("Tinkaton", 9, ["Fairy", "Steel"], 506, 85, 75, 77, "T"),
  p("Baxcalibur", 9, ["Dragon", "Ice"], 600, 115, 145, 92, "B"),
  p("Koraidon", 9, ["Fighting", "Dragon"], 670, 100, 135, 115, "K"),
] satisfies Pokemon[];

export const pokemon = seedPokemon.map((mon) => ({ ...mon, score: monScore(mon) }));

export function buildChoices(rule: DraftRule, team: Pokemon[]) {
  const pickedNames = new Set(team.map((mon) => mon.name));
  let pool = pokemon.filter(
    (mon) => mon.gen === rule.gen && mon.types.includes(rule.type) && !pickedNames.has(mon.name),
  );

  if (pool.length < 5) pool = pokemon.filter((mon) => mon.types.includes(rule.type) && !pickedNames.has(mon.name));
  if (pool.length < 5) pool = pokemon.filter((mon) => mon.gen === rule.gen && !pickedNames.has(mon.name));
  if (pool.length < 5) pool = pokemon.filter((mon) => !pickedNames.has(mon.name));

  return shuffle(pool).slice(0, 5);
}

export function buildEnemyTeam(roundIndex: number) {
  const difficulty = 500 + roundIndex * 28;
  const candidates = pokemon.filter((mon) => mon.score >= difficulty - 55);
  return shuffle(candidates.length >= 6 ? candidates : pokemon).slice(0, 6);
}

export function teamPower(team: Pokemon[]) {
  if (team.length === 0) return 0;
  const raw = team.reduce((sum, mon) => sum + mon.score, 0);
  return raw + synergyBonus(team);
}

export function typeGradient(types: TypeName[]) {
  const first = typeColors[types[0]];
  const second = typeColors[types[1]] ?? "#ffffff";
  return `radial-gradient(circle, rgba(255,255,255,.24), transparent 58%), linear-gradient(135deg, ${first}, ${second})`;
}

function p(
  name: string,
  gen: Generation,
  types: TypeName[],
  total: number,
  hp: number,
  attack: number,
  defense: number,
  mark: string,
): Pokemon {
  return { name, gen, types, total, hp, attack, defense, mark, score: 0 };
}

function monScore(mon: Pick<Pokemon, "total" | "attack" | "defense" | "hp">) {
  return mon.total + mon.attack * 0.38 + mon.defense * 0.22 + mon.hp * 0.18;
}

function synergyBonus(team: Pokemon[]) {
  const typeCounts = new Map<TypeName, number>();
  team.forEach((mon) => mon.types.forEach((type) => typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)));
  const diversity = typeCounts.size * 18;
  const duplicates = [...typeCounts.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + (count - 1) * 20, 0);
  return diversity - duplicates;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
