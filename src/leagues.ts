import { pokemon, type Pokemon } from "./model";

export type LeagueOpponent = {
  name: string;
  title: string;
  team: Pokemon[];
};

export type ChampionLeague = {
  region: string;
  opponents: LeagueOpponent[];
};

const byDex = new Map(pokemon.map((mon) => [mon.dex, mon]));

export const championLeagues: ChampionLeague[] = [
  league("관동", [
    opponent("칸나", "사천왕 1", [87, 91, 80, 124, 131]),
    opponent("시바", "사천왕 2", [95, 107, 106, 95, 68]),
    opponent("국화", "사천왕 3", [94, 42, 93, 24, 94]),
    opponent("목호", "사천왕 4", [130, 148, 148, 142, 149]),
    opponent("그린", "챔피언", [18, 65, 112, 59, 103, 9]),
  ]),
  league("성도", [
    opponent("일목", "사천왕 1", [178, 103, 124, 80, 178]),
    opponent("독수", "사천왕 2", [168, 49, 205, 89, 169]),
    opponent("시바", "사천왕 3", [237, 95, 107, 106, 68]),
    opponent("카렌", "사천왕 4", [197, 45, 94, 198, 229]),
    opponent("목호", "챔피언", [130, 149, 6, 142, 149, 149]),
  ]),
  league("호연", [
    opponent("혁진", "사천왕 1", [262, 275, 332, 342, 359]),
    opponent("회연", "사천왕 2", [356, 354, 354, 302, 356]),
    opponent("미혜", "사천왕 3", [364, 362, 362, 365, 365]),
    opponent("권수", "사천왕 4", [372, 330, 230, 334, 373]),
    opponent("성호", "챔피언", [227, 344, 346, 306, 348, 376]),
  ]),
  league("신오", [
    opponent("충호", "사천왕 1", [269, 267, 416, 214, 452]),
    opponent("들국화", "사천왕 2", [195, 185, 464, 340, 450]),
    opponent("대엽", "사천왕 3", [229, 78, 428, 208, 467]),
    opponent("오엽", "사천왕 4", [122, 203, 308, 65, 437]),
    opponent("난천", "챔피언", [442, 407, 468, 448, 423, 445]),
  ]),
  league("하나", [
    opponent("망초", "사천왕 1", [563, 609, 426, 593]),
    opponent("블래리", "사천왕 2", [560, 625, 510, 452]),
    opponent("카틀레야", "사천왕 3", [518, 579, 576, 561]),
    opponent("연무", "사천왕 4", [538, 534, 539, 620]),
    opponent("노간주", "챔피언", [617, 626, 589, 584, 621, 637]),
  ]),
  league("칼로스", [
    opponent("파키라", "사천왕 1", [668, 663, 324, 609]),
    opponent("즈미", "사천왕 2", [693, 130, 689, 121]),
    opponent("간피", "사천왕 3", [707, 476, 212, 681]),
    opponent("드라세나", "사천왕 4", [691, 621, 334, 715]),
    opponent("카르네", "챔피언", [701, 697, 699, 711, 706, 282]),
  ]),
  league("알로라", [
    opponent("할라", "사천왕 1", [297, 57, 760, 62, 740]),
    opponent("라이치", "사천왕 2", [369, 476, 526, 703, 745]),
    opponent("아세로라", "사천왕 3", [302, 426, 478, 770, 426]),
    opponent("카일리", "사천왕 4", [227, 630, 430, 741, 733]),
    opponent("쿠쿠이", "챔피언", [745, 38, 143, 462, 628, 9]),
  ]),
  league("가라르", [
    opponent("비트", "챌린저 1", [576, 282, 78, 858, 869]),
    opponent("마리", "챌린저 2", [510, 454, 560, 877, 861]),
    opponent("야청", "챌린저 3", [768, 834, 771, 823, 847]),
    opponent("금랑", "챌린저 4", [324, 330, 706, 844, 884]),
    opponent("단델", "챔피언", [681, 612, 887, 537, 866, 6]),
  ]),
  league("팔데아", [
    opponent("칠리", "사천왕 1", [340, 322, 450, 980, 195]),
    opponent("뽀삐", "사천왕 2", [879, 823, 437, 462, 959]),
    opponent("청목", "사천왕 3", [357, 334, 663, 931, 398]),
    opponent("팔자크", "사천왕 4", [715, 691, 612, 621, 706]),
    opponent("테사", "챔피언", [951, 713, 983, 673, 970, 956]),
  ]),
];

function league(region: string, opponents: LeagueOpponent[]): ChampionLeague {
  return { region, opponents };
}

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
