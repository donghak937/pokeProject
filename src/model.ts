import pokemonRows from "./data/pokemon.json";

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
export type MoveCategory = "physical" | "special" | "status";

export type BattleMove = {
  name: string;
  displayName: string;
  type: TypeName;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  target?: string;
  statChanges?: Array<{
    stat: string;
    change: number;
  }>;
};

export type Pokemon = {
  name: string;
  displayName: string;
  dex: number;
  gen: Generation;
  types: TypeName[];
  total: number;
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  mark: string;
  score: number;
  movePool: BattleMove[];
  spriteUrl?: string;
};

export type DraftRule = {
  gen: Generation;
};

export type MatchResult =
  | { round: string; skipped: true }
  | {
      round: string;
      skipped?: false;
      enemy: Pokemon[];
      playerScore: number;
      enemyScore: number;
      winRate: number;
      roll: number;
      win: boolean;
      logs: string[];
      mvp: Pokemon;
      risk: Pokemon;
      leagueRegion?: string;
      revealRegion?: boolean;
    };

export const generationLabels: Record<Generation, string> = {
  1: "관동",
  2: "성도",
  3: "호연",
  4: "신오",
  5: "하나",
  6: "칼로스",
  7: "알로라",
  8: "가라르",
  9: "팔데아",
};

export const typeLabels: Record<TypeName, string> = {
  Normal: "노말",
  Fire: "불꽃",
  Water: "물",
  Grass: "풀",
  Electric: "전기",
  Ice: "얼음",
  Fighting: "격투",
  Poison: "독",
  Ground: "땅",
  Flying: "비행",
  Psychic: "에스퍼",
  Bug: "벌레",
  Rock: "바위",
  Ghost: "고스트",
  Dragon: "드래곤",
  Dark: "악",
  Steel: "강철",
  Fairy: "페어리",
};

export const pokemon = (pokemonRows as Pokemon[]).map((mon) => ({
  ...mon,
  score: monScore(mon),
}));

export function buildChoices(rule: DraftRule, team: Pokemon[]) {
  const pickedNames = new Set(team.map((mon) => mon.name));
  let pool = pokemon.filter((mon) => mon.gen === rule.gen && !pickedNames.has(mon.name));

  if (pool.length < 5) {
    pool = pokemon.filter((mon) => !pickedNames.has(mon.name));
  }

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

function monScore(mon: Pick<Pokemon, "total" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed" | "hp">) {
  return (
    mon.total +
    Math.max(mon.attack, mon.specialAttack) * 0.3 +
    Math.min(mon.attack, mon.specialAttack) * 0.12 +
    Math.max(mon.defense, mon.specialDefense) * 0.2 +
    Math.min(mon.defense, mon.specialDefense) * 0.1 +
    mon.speed * 0.22 +
    mon.hp * 0.16
  );
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
