import { pokemon, type Pokemon } from "./model";

export type LeagueOpponent = {
  name: string;
  title: string;
  team: Pokemon[];
};

const byDex = new Map(pokemon.map((mon) => [mon.dex, mon]));

export const indigoLeague: LeagueOpponent[] = [
  opponent("칸나", "사천왕 1", [87, 91, 80, 124, 131]),
  opponent("시바", "사천왕 2", [95, 107, 106, 95, 68]),
  opponent("국화", "사천왕 3", [94, 42, 93, 24, 94]),
  opponent("목호", "사천왕 4", [130, 148, 148, 142, 149]),
  opponent("그린", "챔피언", [18, 65, 112, 59, 103, 9]),
];

function opponent(name: string, title: string, dexes: number[]): LeagueOpponent {
  return {
    name,
    title,
    team: dexes.map((dex) => {
      const mon = byDex.get(dex);
      if (!mon) {
        throw new Error(`Missing Pokemon dex ${dex} for ${name}`);
      }
      return mon;
    }),
  };
}
