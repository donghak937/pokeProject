import { teamPower, typeLabels, type Pokemon, type TypeName } from "./model";

export type WinProjection = {
  playerScore: number;
  enemyScore: number;
  winRate: number;
  mvp: Pokemon;
  risk: Pokemon;
  logs: string[];
};

type BattleFeedOptions = {
  opponentName?: string;
};

type PairScore = {
  attacker: Pokemon;
  defender: Pokemon;
  score: number;
  attackMultiplier: number;
  defenseRisk: number;
  attackMode: AttackMode;
};

type AttackMode = "physical" | "special";

export function calculateWinProjection(team: Pokemon[], enemy: Pokemon[]): WinProjection {
  const playerPairs = scorePairs(team, enemy);
  const enemyPairs = scorePairs(enemy, team);
  const playerTeamScore = calculateTeamScore(team, playerPairs);
  const enemyTeamScore = calculateTeamScore(enemy, enemyPairs);
  const scoreDiff = playerTeamScore - enemyTeamScore;
  const winRate = clamp(1 / (1 + Math.exp(-scoreDiff / 185)), 0.04, 0.96);
  const bestPair = maxBy(playerPairs, (pair) => pair.score);
  const worstPair = maxBy(enemyPairs, (pair) => pair.score);
  const typeSpread = new Set(team.flatMap((mon) => mon.types)).size;
  const enemyTypeSpread = new Set(enemy.flatMap((mon) => mon.types)).size;

  return {
    playerScore: playerTeamScore,
    enemyScore: enemyTeamScore,
    winRate,
    mvp: bestPair.attacker,
    risk: worstPair.attacker,
    logs: [
      `승률 계산: 내 파티 ${Math.round(playerTeamScore)}점 vs 상대 ${Math.round(enemyTeamScore)}점`,
      `예상 승률 ${(winRate * 100).toFixed(1)}%`,
      `주요 돌파구: ${bestPair.attacker.displayName} -> ${bestPair.defender.displayName} ${attackModeLabel(bestPair.attackMode)} / 상성 ${formatMultiplier(bestPair.attackMultiplier)}`,
      `가장 위험한 상대: ${worstPair.attacker.displayName} -> ${worstPair.defender.displayName} ${attackModeLabel(worstPair.attackMode)} / 상성 ${formatMultiplier(worstPair.attackMultiplier)}`,
      `계산 축: HP, 공격, 방어, 특공, 특방, 스피드, 타입 상성, 타입 다양성`,
      `타입 폭: 내 파티 ${typeSpread}종 / 상대 ${enemyTypeSpread}종`,
    ],
  };
}

export function createBattleFeed(
  team: Pokemon[],
  enemy: Pokemon[],
  playerWins: boolean,
  options: BattleFeedOptions = {},
) {
  const opponentName = options.opponentName ?? "상대";
  const logs: string[] = [];
  let playerActive: Pokemon | undefined = team[0];
  let enemyActive: Pokemon | undefined = enemy[0];
  const playerBench = team.slice(1);
  const enemyBench = enemy.slice(1);

  logs.push(`배틀 시작! 내 선봉 ${playerActive.displayName}, ${opponentName} 선봉 ${enemyActive.displayName}.`);

  let exchanges = 0;
  while (playerActive && enemyActive && exchanges < 12) {
    exchanges += 1;

    const enemySwitch = chooseSwitch(enemyActive, playerActive, enemyBench);
    if (enemySwitch) {
      enemyBench.splice(enemyBench.indexOf(enemySwitch), 1);
      enemyBench.push(enemyActive);
      logs.push(`${opponentName}, ${enemyActive.displayName}에서 ${enemySwitch.displayName} 교체.`);
      enemyActive = enemySwitch;
    }

    const playerSwitch = chooseSwitch(playerActive, enemyActive, playerBench);
    if (playerSwitch) {
      playerBench.splice(playerBench.indexOf(playerSwitch), 1);
      playerBench.push(playerActive);
      logs.push(`내 파티, ${playerActive.displayName}에서 ${playerSwitch.displayName} 교체.`);
      playerActive = playerSwitch;
    }

    const loser = chooseExchangeLoser(playerActive, enemyActive, playerBench.length, enemyBench.length, playerWins);
    const winner = loser === "enemy" ? playerActive : enemyActive;
    const downed = loser === "enemy" ? enemyActive : playerActive;
    logs.push(`${winner.displayName}의 ${bestAttackLabel(winner, downed)} 압박! ${downed.displayName} 다운!`);

    if (loser === "enemy") {
      enemyActive = enemyBench.shift();
      if (enemyActive) logs.push(`${opponentName}, ${enemyActive.displayName} 등장.`);
    } else {
      playerActive = playerBench.shift();
      if (playerActive) logs.push(`내 파티, ${playerActive.displayName} 등장.`);
    }
  }

  if (playerWins && playerActive && enemyActive) {
    logs.push(`${playerActive.displayName}이 마지막까지 버텼다. ${enemyActive.displayName} 다운!`);
    enemyActive = undefined;
  }

  if (!playerWins && playerActive && enemyActive) {
    logs.push(`${enemyActive.displayName}이 마무리했다. ${playerActive.displayName} 다운!`);
    playerActive = undefined;
  }

  const survivors = playerWins ? (playerActive ? 1 : 0) + playerBench.length : (enemyActive ? 1 : 0) + enemyBench.length;
  logs.push(playerWins ? `승리! 남은 포켓몬 ${survivors}마리.` : `패배... ${opponentName} 남은 포켓몬 ${survivors}마리.`);
  return logs;
}

function scorePairs(attackers: Pokemon[], defenders: Pokemon[]) {
  return attackers.flatMap((attacker) =>
    defenders.map((defender) => {
      const attackMultiplier = bestAttackMultiplier(attacker.types, defender.types);
      const defenseRisk = bestAttackMultiplier(defender.types, attacker.types);
      const attackMode = bestAttackMode(attacker, defender);
      const score =
        offensivePower(attacker, defender, attackMode) * matchupBoost(attackMultiplier) +
        speedTempo(attacker, defender) -
        defensivePressure(defender, attacker) * matchupRisk(defenseRisk) * 0.42;
      return { attacker, defender, score, attackMultiplier, defenseRisk, attackMode };
    }),
  );
}

function calculateTeamScore(team: Pokemon[], pairs: PairScore[]) {
  const averagePairScore = average(pairs.map((pair) => pair.score));
  const topPairs = [...pairs].sort((a, b) => b.score - a.score).slice(0, Math.max(3, team.length));
  const topPairAverage = average(topPairs.map((pair) => pair.score));
  const rawPower = teamPower(team);
  const diversityBonus = new Set(team.flatMap((mon) => mon.types)).size * 16;
  const duplicatePenalty = duplicateTypePenalty(team);
  return rawPower * 0.52 + averagePairScore * 0.28 + topPairAverage * 0.2 + diversityBonus - duplicatePenalty;
}

function chooseSwitch(active: Pokemon, opponent: Pokemon, bench: Pokemon[]) {
  if (bench.length === 0) return undefined;
  const activeScore = duelScore(active, opponent);
  const replacement = maxBy(bench, (mon) => duelScore(mon, opponent));
  const replacementScore = duelScore(replacement, opponent);
  const isPinned = bestAttackMultiplier(opponent.types, active.types) >= 2;

  if (replacementScore > activeScore + 85 && (isPinned || Math.random() < 0.45)) {
    return replacement;
  }

  return undefined;
}

function chooseExchangeLoser(
  playerActive: Pokemon,
  enemyActive: Pokemon,
  playerBenchCount: number,
  enemyBenchCount: number,
  playerWins: boolean,
) {
  if (playerWins && enemyBenchCount === 0) return "enemy";
  if (!playerWins && playerBenchCount === 0) return "player";

  const playerEdge = duelScore(playerActive, enemyActive) - duelScore(enemyActive, playerActive);
  const upsetChance = clamp(0.28 - Math.abs(playerEdge) / 1200, 0.08, 0.28);
  const favoredLoser = playerEdge >= 0 ? "enemy" : "player";
  const resultByMatchup = Math.random() < upsetChance ? oppositeSide(favoredLoser) : favoredLoser;

  if (playerWins) return Math.random() < 0.72 ? "enemy" : resultByMatchup;
  return Math.random() < 0.72 ? "player" : resultByMatchup;
}

function oppositeSide(side: "player" | "enemy") {
  return side === "player" ? "enemy" : "player";
}

function duelScore(attacker: Pokemon, defender: Pokemon) {
  const attackMultiplier = bestAttackMultiplier(attacker.types, defender.types);
  const defenseRisk = bestAttackMultiplier(defender.types, attacker.types);
  const attackMode = bestAttackMode(attacker, defender);
  return (
    offensivePower(attacker, defender, attackMode) * matchupBoost(attackMultiplier) +
    speedTempo(attacker, defender) -
    defensivePressure(defender, attacker) * matchupRisk(defenseRisk) * 0.36
  );
}

function pokemonPower(mon: Pokemon) {
  return (
    mon.total +
    Math.max(mon.attack, mon.specialAttack) * 0.32 +
    Math.min(mon.attack, mon.specialAttack) * 0.12 +
    Math.max(mon.defense, mon.specialDefense) * 0.22 +
    Math.min(mon.defense, mon.specialDefense) * 0.1 +
    mon.speed * 0.24 +
    mon.hp * 0.18
  );
}

function offensivePower(attacker: Pokemon, defender: Pokemon, mode: AttackMode) {
  const attackStat = mode === "physical" ? attacker.attack : attacker.specialAttack;
  const defenseStat = mode === "physical" ? defender.defense : defender.specialDefense;
  const bulkTax = defender.hp * 0.22 + defenseStat * 0.42;
  return pokemonPower(attacker) + attackStat * 1.35 - bulkTax;
}

function defensivePressure(defender: Pokemon, attacker: Pokemon) {
  const incomingMode = bestAttackMode(attacker, defender);
  const relevantDefense = incomingMode === "physical" ? defender.defense : defender.specialDefense;
  return pokemonPower(defender) + defender.hp * 0.34 + relevantDefense * 0.58;
}

function bestAttackMode(attacker: Pokemon, defender: Pokemon): AttackMode {
  const physical = attacker.attack * 1.25 - defender.defense * 0.72;
  const special = attacker.specialAttack * 1.25 - defender.specialDefense * 0.72;
  return physical >= special ? "physical" : "special";
}

function speedTempo(attacker: Pokemon, defender: Pokemon) {
  const speedDiff = attacker.speed - defender.speed;
  if (speedDiff >= 50) return 42;
  if (speedDiff >= 25) return 26;
  if (speedDiff >= 10) return 12;
  if (speedDiff <= -50) return -36;
  if (speedDiff <= -25) return -22;
  if (speedDiff <= -10) return -10;
  return 0;
}

function attackModeLabel(mode: AttackMode) {
  return mode === "physical" ? "물리 우세" : "특수 우세";
}

function bestAttackLabel(attacker: Pokemon, defender: Pokemon) {
  const bestType = maxBy(attacker.types, (attackType) =>
    Math.max(...defender.types.map((defenseType) => typeChart[attackType]?.[defenseType] ?? 1)),
  );
  return typeLabels[bestType];
}

function bestAttackMultiplier(attackerTypes: TypeName[], defenderTypes: TypeName[]) {
  return Math.max(
    ...attackerTypes.flatMap((attackType) =>
      defenderTypes.map((defenseType) => typeChart[attackType]?.[defenseType] ?? 1),
    ),
  );
}

function matchupBoost(multiplier: number) {
  if (multiplier >= 4) return 1.85;
  if (multiplier >= 2) return 1.45;
  if (multiplier === 0) return 0.18;
  if (multiplier <= 0.25) return 0.42;
  if (multiplier <= 0.5) return 0.68;
  return 1;
}

function matchupRisk(multiplier: number) {
  if (multiplier >= 4) return 1.75;
  if (multiplier >= 2) return 1.35;
  if (multiplier === 0) return 0.2;
  if (multiplier <= 0.5) return 0.72;
  return 1;
}

function duplicateTypePenalty(team: Pokemon[]) {
  const counts = new Map<TypeName, number>();
  team.forEach((mon) => mon.types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1)));
  return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1) * 18, 0);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function maxBy<T>(items: T[], score: (item: T) => number) {
  return items.reduce((best, item) => (score(item) > score(best) ? item : best));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMultiplier(multiplier: number) {
  if (multiplier === 0) return "무효";
  if (multiplier > 1) return `${multiplier}배 유리`;
  if (multiplier < 1) return `${multiplier}배 불리`;
  return "보통";
}

const typeChart: Record<TypeName, Partial<Record<TypeName, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Grass: 2, Ice: 2, Bug: 2, Steel: 2, Fire: 0.5, Water: 0.5, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2, Ground: 2, Rock: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Grass: { Water: 2, Ground: 2, Rock: 2, Fire: 0.5, Grass: 0.5, Poison: 0.5, Flying: 0.5, Bug: 0.5, Dragon: 0.5, Steel: 0.5 },
  Electric: { Water: 2, Flying: 2, Electric: 0.5, Grass: 0.5, Dragon: 0.5, Ground: 0 },
  Ice: { Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Fire: 0.5, Water: 0.5, Ice: 0.5, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Rock: 2, Dark: 2, Steel: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Fairy: 0.5, Ghost: 0 },
  Poison: { Grass: 2, Fairy: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0 },
  Ground: { Fire: 2, Electric: 2, Poison: 2, Rock: 2, Steel: 2, Grass: 0.5, Bug: 0.5, Flying: 0 },
  Flying: { Grass: 2, Fighting: 2, Bug: 2, Electric: 0.5, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: { Grass: 2, Psychic: 2, Dark: 2, Fire: 0.5, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Ghost: 0.5, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Flying: 2, Bug: 2, Fighting: 0.5, Ground: 0.5, Steel: 0.5 },
  Ghost: { Psychic: 2, Ghost: 2, Dark: 0.5, Normal: 0 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Steel: { Ice: 2, Rock: 2, Fairy: 2, Fire: 0.5, Water: 0.5, Electric: 0.5, Steel: 0.5 },
  Fairy: { Fighting: 2, Dragon: 2, Dark: 2, Fire: 0.5, Poison: 0.5, Steel: 0.5 },
};
