import { teamPower, typeLabels, type BattleMove, type Pokemon, type TypeName } from "./model";

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
  playerMoves?: MoveSet;
  enemyMoves?: MoveSet;
};

export type MoveSet = Record<string, BattleMove[]>;

type PairScore = {
  attacker: Pokemon;
  defender: Pokemon;
  score: number;
  attackMultiplier: number;
  defenseRisk: number;
  attackMode: AttackMode;
};

type AttackMode = "physical" | "special";
type BattleStat = "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";
type BattleStages = Record<BattleStat, number>;

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
  const hp = new Map<string, number>([...team, ...enemy].map((mon) => [mon.name, 100]));
  const stages = new Map<string, BattleStages>([...team, ...enemy].map((mon) => [mon.name, emptyStages()]));

  logs.push(`배틀 시작! 내 선봉 ${playerActive.displayName}, ${opponentName} 선봉 ${enemyActive.displayName}.`);

  let turns = 0;
  while (playerActive && enemyActive && turns < 48) {
    turns += 1;

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

    const firstSide = modifiedStat(playerActive, "speed", stages) >= modifiedStat(enemyActive, "speed", stages) ? "player" : "enemy";
    const actions = firstSide === "player" ? (["player", "enemy"] as const) : (["enemy", "player"] as const);

    for (const side of actions) {
      if (!playerActive || !enemyActive) break;
      const attacker = side === "player" ? playerActive : enemyActive;
      const defender = side === "player" ? enemyActive : playerActive;
      const moveSet = side === "player" ? options.playerMoves : options.enemyMoves;
      const bias = side === "player" === playerWins ? 1.08 : 0.88;
      const boostMove = chooseBoostMove(attacker, moveSet?.[attacker.name], stages, bias);
      if (boostMove) {
        logs.push(applyBoostMove(attacker, boostMove, stages));
        continue;
      }

      const result = calculateMoveDamage(attacker, defender, moveSet?.[attacker.name], bias, stages);
      if (result.missed) {
        logs.push(formatMoveDamage(attacker, defender, result, hp.get(defender.name) ?? 100));
        continue;
      }
      const nextHp = Math.max(0, Math.round((hp.get(defender.name) ?? 100) - result.damage));
      hp.set(defender.name, nextHp);
      logs.push(formatMoveDamage(attacker, defender, result, nextHp));

      if (nextHp > 0) continue;

      logs.push(`${defender.displayName} 다운!`);
      if (side === "player") {
        enemyActive = enemyBench.shift();
        if (enemyActive) logs.push(`${opponentName}, ${enemyActive.displayName} 등장.`);
      } else {
        playerActive = playerBench.shift();
        if (playerActive) logs.push(`내 파티, ${playerActive.displayName} 등장.`);
      }
    }
  }

  if (playerWins && playerActive && enemyActive) {
    const result = calculateMoveDamage(playerActive, enemyActive, options.playerMoves?.[playerActive.name], 1.25, stages);
    logs.push(formatMoveDamage(playerActive, enemyActive, result, 0));
    logs.push(`${enemyActive.displayName} 다운!`);
    enemyActive = undefined;
  }

  if (!playerWins && playerActive && enemyActive) {
    const result = calculateMoveDamage(enemyActive, playerActive, options.enemyMoves?.[enemyActive.name], 1.25, stages);
    logs.push(formatMoveDamage(enemyActive, playerActive, result, 0));
    logs.push(`${playerActive.displayName} 다운!`);
    playerActive = undefined;
  }

  while (playerWins && enemyBench.length > 0) {
    const downed = enemyBench.shift();
    if (downed) logs.push(`${opponentName}, ${downed.displayName} 다운!`);
  }

  while (!playerWins && playerBench.length > 0) {
    const downed = playerBench.shift();
    if (downed) logs.push(`내 파티, ${downed.displayName} 다운!`);
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

function calculateMoveDamage(
  attacker: Pokemon,
  defender: Pokemon,
  moves: BattleMove[] | undefined,
  bias: number,
  stages?: Map<string, BattleStages>,
) {
  const move = chooseBestMove(attacker, defender, moves);
  if (!move) {
    return {
      move: undefined,
      damage: clamp(Math.round((duelScore(attacker, defender) / 38) * bias), 8, 34),
      multiplier: bestAttackMultiplier(attacker.types, defender.types),
      missed: false,
    };
  }

  const multiplier = bestAttackMultiplier([move.type], defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const attackStat =
    move.category === "physical"
      ? modifiedStat(attacker, "attack", stages)
      : move.category === "special"
        ? modifiedStat(attacker, "specialAttack", stages)
        : Math.max(modifiedStat(attacker, "attack", stages), modifiedStat(attacker, "specialAttack", stages)) * 0.6;
  const defenseStat =
    move.category === "physical"
      ? modifiedStat(defender, "defense", stages)
      : move.category === "special"
        ? modifiedStat(defender, "specialDefense", stages)
        : Math.max(modifiedStat(defender, "defense", stages), modifiedStat(defender, "specialDefense", stages));
  const power = move.power ?? 25;
  const accuracy = (move.accuracy ?? 100) / 100;
  if (Math.random() > accuracy) {
    return { move, damage: 0, multiplier, missed: true };
  }

  const randomFactor = 0.88 + Math.random() * 0.16;
  const raw = ((power * (attackStat / Math.max(35, defenseStat)) * stab * multiplier) / Math.max(40, defender.hp)) * 18;
  const damage = clamp(Math.round(raw * randomFactor * bias), multiplier >= 2 ? 12 : 4, multiplier >= 4 ? 88 : 68);

  return { move, damage, multiplier, missed: false };
}

function formatMoveDamage(
  attacker: Pokemon,
  defender: Pokemon,
  result: { move?: BattleMove; damage: number; multiplier: number; missed?: boolean },
  nextHp: number,
) {
  const moveName = result.move?.displayName ?? `${bestAttackLabel(attacker, defender)} 공격`;
  if (result.missed) {
    return `${attacker.displayName}의 ${moveName}! 그러나 빗나갔다!`;
  }

  const effectText = formatEffectText(result.multiplier);
  return `${attacker.displayName}의 ${moveName}! ${effectText}${defender.displayName}에게 ${result.damage}% 피해. 남은 HP ${nextHp}%.`;
}

function chooseBoostMove(
  attacker: Pokemon,
  moves: BattleMove[] | undefined,
  stages: Map<string, BattleStages>,
  bias: number,
) {
  const currentStages = stages.get(attacker.name) ?? emptyStages();
  const boostMoves = (moves ?? []).filter((move) =>
    move.category === "status" &&
    (move.target === "user" || move.target === "users-field") &&
    (move.statChanges ?? []).some((change) => toBattleStat(change.stat) && change.change > 0),
  );
  if (boostMoves.length === 0) return undefined;

  const alreadyBoosted = Object.values(currentStages).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (alreadyBoosted >= 4) return undefined;

  const chance = bias >= 1 ? 0.28 : 0.14;
  if (Math.random() > chance) return undefined;
  return randomItem(boostMoves);
}

function applyBoostMove(attacker: Pokemon, move: BattleMove, stages: Map<string, BattleStages>) {
  const currentStages = stages.get(attacker.name) ?? emptyStages();
  const changedLabels: string[] = [];

  for (const change of move.statChanges ?? []) {
    const stat = toBattleStat(change.stat);
    if (!stat || change.change <= 0) continue;
    const before = currentStages[stat];
    currentStages[stat] = clamp(before + change.change, -6, 6);
    if (currentStages[stat] !== before) {
      changedLabels.push(`${battleStatLabel(stat)} ${change.change >= 2 ? "크게 " : ""}상승`);
    }
  }

  stages.set(attacker.name, currentStages);
  return `${attacker.displayName}의 ${move.displayName}! ${changedLabels.length > 0 ? changedLabels.join(", ") : "기세를 끌어올렸다"}.`;
}

function emptyStages(): BattleStages {
  return {
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };
}

function modifiedStat(mon: Pokemon, stat: BattleStat, stages?: Map<string, BattleStages>) {
  const base = mon[stat];
  const stage = stages?.get(mon.name)?.[stat] ?? 0;
  return base * stageMultiplier(stage);
}

function stageMultiplier(stage: number) {
  if (stage >= 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

function toBattleStat(stat: string): BattleStat | undefined {
  if (stat === "attack") return "attack";
  if (stat === "defense") return "defense";
  if (stat === "special-attack") return "specialAttack";
  if (stat === "special-defense") return "specialDefense";
  if (stat === "speed") return "speed";
  return undefined;
}

function battleStatLabel(stat: BattleStat) {
  if (stat === "attack") return "공격";
  if (stat === "defense") return "방어";
  if (stat === "specialAttack") return "특공";
  if (stat === "specialDefense") return "특방";
  return "스피드";
}

function chooseBestMove(attacker: Pokemon, defender: Pokemon, moves: BattleMove[] = []) {
  const damagingMoves = moves.filter((move) => move.category !== "status" && move.power !== null);
  const candidates = damagingMoves.length > 0 ? damagingMoves : moves;
  if (candidates.length === 0) return undefined;

  return maxBy(candidates, (move) => {
    const multiplier = bestAttackMultiplier([move.type], defender.types);
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const accuracy = (move.accuracy ?? 100) / 100;
    const power = move.power ?? 20;
    const categoryFit =
      move.category === "physical"
        ? attacker.attack - defender.defense * 0.45
        : move.category === "special"
          ? attacker.specialAttack - defender.specialDefense * 0.45
          : 0;
    return power * multiplier * stab * accuracy + categoryFit;
  });
}

function formatEffectText(multiplier: number) {
  if (multiplier === 0) return "효과가 없었다... 하지만 빈틈을 만들었다. ";
  if (multiplier >= 2) return "효과가 굉장했다! ";
  if (multiplier < 1) return "효과는 별로였다. ";
  return "";
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

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
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
