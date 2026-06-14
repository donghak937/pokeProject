import Showdown from "pokemon-showdown";

const { BattleStream, Teams } = Showdown;

export function toShowdownSet(mon, moves, ability) {
  const selectedMoves = (moves?.length ? moves : mon.movePool ?? [])
    .filter((move) => move.category !== "status" || move.power)
    .slice(0, 4)
    .map((move) => move.name);

  return {
    name: mon.name,
    species: mon.name,
    item: "",
    ability: ability?.id ?? mon.abilities?.[0]?.id ?? "",
    moves: selectedMoves.length > 0 ? selectedMoves : ["Tackle"],
    nature: "Serious",
    evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
    gender: "",
    shiny: false,
  };
}

export function packShowdownTeam(team, moveSet = {}, abilitySet = {}) {
  return Teams.pack(team.map((mon) => toShowdownSet(mon, moveSet[mon.name], abilitySet[mon.name])));
}

export function createShowdownBattle({ team, enemy, playerMoves = {}, enemyMoves = {}, playerAbilities = {}, enemyAbilities = {}, seed }) {
  const stream = new BattleStream({ debug: true });
  const chunks = [];

  void (async () => {
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  })();

  stream.write(`>start ${JSON.stringify({ formatid: "gen9customgame", seed })}`);
  stream.write(`>player p1 ${JSON.stringify({ name: "Player", team: packShowdownTeam(team, playerMoves, playerAbilities) })}`);
  stream.write(`>player p2 ${JSON.stringify({ name: "Enemy", team: packShowdownTeam(enemy, enemyMoves, enemyAbilities) })}`);

  return {
    stream,
    chunks,
    write(choice) {
      stream.write(choice);
    },
    snapshot() {
      return [...chunks];
    },
  };
}

export async function waitForChunks(ms = 100) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
