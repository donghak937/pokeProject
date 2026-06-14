import { teamPower, typeLabels, type BattleAbility, type BattleMove, type Pokemon, type StatusCondition, type TypeName } from "./model";

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
  playerAbilities?: AbilitySet;
  enemyAbilities?: AbilitySet;
};

export type MoveSet = Record<string, BattleMove[]>;
export type AbilitySet = Record<string, BattleAbility>;
export type BattleFeedResult = {
  logs: string[];
  playerWon: boolean;
  playerSurvivors: number;
  enemySurvivors: number;
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
type BattleStat = "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";
type BattleStages = Record<BattleStat, number>;
type BattleStatusState = {
  condition: StatusCondition;
  turns: number;
};
type WeatherCondition = "rain" | "sun" | "sand" | "snow";
type WeatherState = {
  condition?: WeatherCondition;
  turns: number;
};

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
): BattleFeedResult {
  const opponentName = options.opponentName ?? "상대";
  const logs: string[] = [];
  let playerActive: Pokemon | undefined = team[0];
  let enemyActive: Pokemon | undefined = enemy[0];
  const playerBench = team.slice(1);
  const enemyBench = enemy.slice(1);
  const hp = new Map<string, number>([...team, ...enemy].map((mon) => [mon.name, initialBattleHp(mon)]));
  const stages = new Map<string, BattleStages>([...team, ...enemy].map((mon) => [mon.name, emptyStages()]));
  const statuses = new Map<string, BattleStatusState>();
  const weather: WeatherState = { turns: 0 };
  const sturdyUsed = new Set<string>();
  const playerAbilities = options.playerAbilities ?? {};
  const enemyAbilities = options.enemyAbilities ?? {};
  const abilityFor = (side: "player" | "enemy", mon: Pokemon) =>
    side === "player" ? playerAbilities[mon.name] : enemyAbilities[mon.name];

  logs.push(`배틀 시작! 내 선봉 ${playerActive.displayName}, ${opponentName} 선봉 ${enemyActive.displayName}.`);
  logs.push(
    ...applyEntryAbility(playerActive, enemyActive, abilityFor("player", playerActive), abilityFor("enemy", enemyActive), stages, weather, "내 파티"),
  );
  logs.push(
    ...applyEntryAbility(enemyActive, playerActive, abilityFor("enemy", enemyActive), abilityFor("player", playerActive), stages, weather, opponentName),
  );

  let turns = 0;
  while (playerActive && enemyActive && turns < 48) {
    turns += 1;

    const enemySwitch = chooseSwitch(enemyActive, playerActive, enemyBench, abilityFor("player", playerActive));
    if (enemySwitch) {
      enemyBench.splice(enemyBench.indexOf(enemySwitch), 1);
      logs.push(...applySwitchOutAbility(enemyActive, hp, statuses, abilityFor("enemy", enemyActive), opponentName));
      enemyBench.push(enemyActive);
      logs.push(`${opponentName}, ${enemyActive.displayName}에서 ${enemySwitch.displayName} 교체.`);
      enemyActive = enemySwitch;
      logs.push(
        ...applyEntryAbility(
          enemyActive,
          playerActive,
          abilityFor("enemy", enemyActive),
          abilityFor("player", playerActive),
          stages,
          weather,
          opponentName,
        ),
      );
    }

    const playerSwitch = chooseSwitch(playerActive, enemyActive, playerBench, abilityFor("enemy", enemyActive));
    if (playerSwitch) {
      playerBench.splice(playerBench.indexOf(playerSwitch), 1);
      logs.push(...applySwitchOutAbility(playerActive, hp, statuses, abilityFor("player", playerActive), "내 파티"));
      playerBench.push(playerActive);
      logs.push(`내 파티, ${playerActive.displayName}에서 ${playerSwitch.displayName} 교체.`);
      playerActive = playerSwitch;
      logs.push(
        ...applyEntryAbility(
          playerActive,
          enemyActive,
          abilityFor("player", playerActive),
          abilityFor("enemy", enemyActive),
          stages,
          weather,
          "내 파티",
        ),
      );
    }

    const playerPreviewMove = chooseBestMove(playerActive, enemyActive, options.playerMoves?.[playerActive.name]);
    const enemyPreviewMove = chooseBestMove(enemyActive, playerActive, options.enemyMoves?.[enemyActive.name]);
    const playerPriority = actionPriority(abilityFor("player", playerActive), playerPreviewMove, abilityFor("enemy", enemyActive));
    const enemyPriority = actionPriority(abilityFor("enemy", enemyActive), enemyPreviewMove, abilityFor("player", playerActive));
    const firstSide =
      playerPriority !== enemyPriority
        ? playerPriority > enemyPriority
          ? "player"
          : "enemy"
        : modifiedStat(playerActive, "speed", stages, statuses, abilityFor("player", playerActive), weather) >=
            modifiedStat(enemyActive, "speed", stages, statuses, abilityFor("enemy", enemyActive), weather)
          ? "player"
          : "enemy";
    const actions = firstSide === "player" ? (["player", "enemy"] as const) : (["enemy", "player"] as const);

    for (const side of actions) {
      if (!playerActive || !enemyActive) break;
      const attacker = side === "player" ? playerActive : enemyActive;
      const defender = side === "player" ? enemyActive : playerActive;
      const moveSet = side === "player" ? options.playerMoves : options.enemyMoves;
      const attackerAbility = abilityFor(side, attacker);
      const defenderAbility = abilityFor(side === "player" ? "enemy" : "player", defender);
      const bias = side === "player" === playerWins ? 1.08 : 0.88;
      const statusStop = beforeActionStatus(attacker, statuses);
      if (statusStop) {
        logs.push(statusStop);
        continue;
      }
      const boostMove = chooseBoostMove(attacker, moveSet?.[attacker.name], stages, bias);
      if (boostMove) {
        logs.push(applyBoostMove(attacker, boostMove, stages));
        continue;
      }

      const result = calculateMoveDamage(
        attacker,
        defender,
        moveSet?.[attacker.name],
        bias,
        stages,
        statuses,
        attackerAbility,
        defenderAbility,
        sturdyUsed,
        weather,
      );
      if (result.missed) {
        logs.push(formatMoveDamage(attacker, defender, result, hp.get(defender.name) ?? 100));
        continue;
      }
      const nextHp = Math.max(0, Math.round((hp.get(defender.name) ?? 100) - result.damage));
      hp.set(defender.name, nextHp);
      logs.push(formatMoveDamage(attacker, defender, result, nextHp));
      if (result.abilityNote) logs.push(result.abilityNote);
      if (result.attackerDamage && result.attackerDamage > 0) {
        const attackerHp = Math.max(0, Math.round((hp.get(attacker.name) ?? 100) - result.attackerDamage));
        hp.set(attacker.name, attackerHp);
        logs.push(`${attacker.displayName}${subjectParticle(attacker.displayName)} 특성 피해로 ${result.attackerDamage}% 피해. 남은 HP ${attackerHp}%.`);
      }
      if (result.statusApplied) {
        statuses.set(defender.name, { condition: result.statusApplied, turns: initialStatusTurns(result.statusApplied, defenderAbility) });
        logs.push(`${defender.displayName}${subjectParticle(defender.displayName)} ${statusLabel(result.statusApplied)} 상태가 되었다!`);
      }
      if (result.attackerStatusApplied) {
        statuses.set(attacker.name, { condition: result.attackerStatusApplied, turns: initialStatusTurns(result.attackerStatusApplied, attackerAbility) });
        logs.push(`${attacker.displayName}${subjectParticle(attacker.displayName)} ${statusLabel(result.attackerStatusApplied)} 상태가 되었다!`);
      }

      if (nextHp > 0) {
        if ((hp.get(attacker.name) ?? 100) <= 0) logs.push(`${attacker.displayName} 다운!`);
        continue;
      }

      logs.push(`${defender.displayName} 다운!`);
      const aftermathDamage = knockoutContactDamage(result.move, defenderAbility, attackerAbility);
      if (aftermathDamage > 0) {
        const attackerHp = Math.max(0, Math.round((hp.get(attacker.name) ?? 100) - aftermathDamage));
        hp.set(attacker.name, attackerHp);
        logs.push(`${defender.displayName}의 ${defenderAbility?.name}! ${attacker.displayName}에게 ${aftermathDamage}% 피해. 남은 HP ${attackerHp}%.`);
      }
      const knockoutLog = applyKnockoutAbility(attacker, abilityFor(side, attacker), stages);
      if (knockoutLog) logs.push(knockoutLog);
      if (side === "player") {
        enemyActive = enemyBench.shift();
        if (enemyActive) {
          logs.push(`${opponentName}, ${enemyActive.displayName} 등장.`);
          logs.push(
            ...applyEntryAbility(
              enemyActive,
              playerActive,
              abilityFor("enemy", enemyActive),
              abilityFor("player", playerActive),
              stages,
              weather,
              opponentName,
            ),
          );
        }
      } else {
        playerActive = playerBench.shift();
        if (playerActive) {
          logs.push(`내 파티, ${playerActive.displayName} 등장.`);
          logs.push(
            ...applyEntryAbility(
              playerActive,
              enemyActive,
              abilityFor("player", playerActive),
              abilityFor("enemy", enemyActive),
              stages,
              weather,
              "내 파티",
            ),
          );
        }
      }
    }

    const endLogs = applyEndTurnStatus(playerActive, enemyActive, hp, statuses, stages, weather, abilityFor);
    logs.push(...endLogs);
    if (playerActive && (hp.get(playerActive.name) ?? 100) <= 0) {
      logs.push(`${playerActive.displayName} 다운!`);
      playerActive = playerBench.shift();
      if (playerActive) {
        logs.push(`내 파티, ${playerActive.displayName} 등장.`);
        logs.push(
          ...applyEntryAbility(
            playerActive,
            enemyActive,
            abilityFor("player", playerActive),
            enemyActive ? abilityFor("enemy", enemyActive) : undefined,
            stages,
            weather,
            "내 파티",
          ),
        );
      }
    }
    if (enemyActive && (hp.get(enemyActive.name) ?? 100) <= 0) {
      logs.push(`${enemyActive.displayName} 다운!`);
      enemyActive = enemyBench.shift();
      if (enemyActive) {
        logs.push(`${opponentName}, ${enemyActive.displayName} 등장.`);
        logs.push(
          ...applyEntryAbility(
            enemyActive,
            playerActive,
            abilityFor("enemy", enemyActive),
            playerActive ? abilityFor("player", playerActive) : undefined,
            stages,
            weather,
            opponentName,
          ),
        );
      }
    }
  }

  let playerSurvivors = remainingCount(playerActive, playerBench, hp);
  let enemySurvivors = remainingCount(enemyActive, enemyBench, hp);
  let resolvedPlayerWins =
    enemySurvivors === 0 && playerSurvivors > 0 ? true : playerSurvivors === 0 && enemySurvivors > 0 ? false : playerWins;

  if (resolvedPlayerWins && playerActive && enemyActive) {
    const result = calculateMoveDamage(
      playerActive,
      enemyActive,
      options.playerMoves?.[playerActive.name],
      1.25,
      stages,
      statuses,
      abilityFor("player", playerActive),
      abilityFor("enemy", enemyActive),
      sturdyUsed,
      weather,
    );
    logs.push(formatMoveDamage(playerActive, enemyActive, result, 0));
    logs.push(`${enemyActive.displayName} 다운!`);
    hp.set(enemyActive.name, 0);
    enemyActive = undefined;
  }

  if (!resolvedPlayerWins && playerActive && enemyActive) {
    const result = calculateMoveDamage(
      enemyActive,
      playerActive,
      options.enemyMoves?.[enemyActive.name],
      1.25,
      stages,
      statuses,
      abilityFor("enemy", enemyActive),
      abilityFor("player", playerActive),
      sturdyUsed,
      weather,
    );
    logs.push(formatMoveDamage(enemyActive, playerActive, result, 0));
    logs.push(`${playerActive.displayName} 다운!`);
    hp.set(playerActive.name, 0);
    playerActive = undefined;
  }

  while (resolvedPlayerWins && enemyBench.length > 0) {
    const downed = enemyBench.shift();
    if (downed) logs.push(`${opponentName}, ${downed.displayName} 다운!`);
  }

  while (!resolvedPlayerWins && playerBench.length > 0) {
    const downed = playerBench.shift();
    if (downed) logs.push(`내 파티, ${downed.displayName} 다운!`);
  }

  playerSurvivors = remainingCount(playerActive, playerBench, hp);
  enemySurvivors = remainingCount(enemyActive, enemyBench, hp);
  resolvedPlayerWins = enemySurvivors === 0 && playerSurvivors > 0 ? true : playerSurvivors === 0 && enemySurvivors > 0 ? false : resolvedPlayerWins;
  const resolvedSurvivors = resolvedPlayerWins ? playerSurvivors : enemySurvivors;
  logs.push(resolvedPlayerWins ? `승리! 남은 포켓몬 ${resolvedSurvivors}마리.` : `패배... ${opponentName} 남은 포켓몬 ${resolvedSurvivors}마리.`);
  return { logs, playerWon: resolvedPlayerWins, playerSurvivors, enemySurvivors };
}

function remainingCount(active: Pokemon | undefined, bench: Pokemon[], hp: Map<string, number>) {
  return (active && (hp.get(active.name) ?? 0) > 0 ? 1 : 0) + bench.filter((mon) => (hp.get(mon.name) ?? 0) > 0).length;
}

function initialBattleHp(mon: Pokemon) {
  return mon.hp <= 1 ? 1 : 100;
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

function chooseSwitch(active: Pokemon, opponent: Pokemon, bench: Pokemon[], opponentAbility?: BattleAbility) {
  if (bench.length === 0) return undefined;
  if (isTrappedByAbility(active, opponentAbility)) return undefined;
  const activeScore = duelScore(active, opponent);
  const replacement = maxBy(bench, (mon) => duelScore(mon, opponent));
  const replacementScore = duelScore(replacement, opponent);
  const isPinned = bestAttackMultiplier(opponent.types, active.types) >= 2;

  if (replacementScore > activeScore + 85 && (isPinned || Math.random() < 0.45)) {
    return replacement;
  }

  return undefined;
}

function isTrappedByAbility(active: Pokemon, opponentAbility: BattleAbility | undefined) {
  if (opponentAbility?.id === "shadow-tag") {
    return !active.types.includes("Ghost");
  }
  if (opponentAbility?.id === "arena-trap") {
    return !active.types.includes("Flying") && active.types.every((type) => type !== "Ghost");
  }
  if (opponentAbility?.id === "magnet-pull") {
    return active.types.includes("Steel");
  }
  return false;
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
  statuses?: Map<string, BattleStatusState>,
  attackerAbility?: BattleAbility,
  defenderAbility?: BattleAbility,
  sturdyUsed?: Set<string>,
  weather?: WeatherState,
) {
  const chosenMove = chooseBestMove(attacker, defender, moves);
  const effectiveDefenderAbility = ignoresDefensiveAbility(attackerAbility) ? undefined : defenderAbility;
  const activeWeather = suppressesWeather(attackerAbility) || suppressesWeather(effectiveDefenderAbility) ? undefined : weather;
  if (!chosenMove) {
    return {
      move: undefined,
      damage: clamp(Math.round((duelScore(attacker, defender) / 38) * bias), 8, 34),
      multiplier: bestAttackMultiplier(attacker.types, defender.types),
      missed: false,
      statusApplied: undefined,
      abilityNote: undefined,
    };
  }
  const move = applyMoveTypeAbility(chosenMove, attackerAbility);

  const immunity = abilityImmunity(defender, effectiveDefenderAbility, move, stages);
  if (immunity) {
    return { move, damage: 0, multiplier: 0, missed: false, statusApplied: undefined, attackerStatusApplied: undefined, abilityNote: immunity };
  }

  const rawMultiplier = bestAttackMultiplier([move.type], defender.types);
  const multiplier =
    attackerAbility?.id === "scrappy" && rawMultiplier === 0 && (move.type === "Normal" || move.type === "Fighting")
      ? 1
      : effectiveDefenderAbility?.id === "levitate" && move.type === "Ground"
        ? 0
        : rawMultiplier;
  const stab =
    attacker.types.includes(move.type) || changesUserTypeForMove(attackerAbility, move)
      ? attackerAbility?.id === "adaptability"
        ? 2
        : 1.5
      : 1;
  const burnAttackPenalty =
    move.category === "physical" && statuses?.get(attacker.name)?.condition === "burn" && attackerAbility?.id !== "guts" ? 0.55 : 1;
  const gutsBoost = attackerAbility?.id === "guts" && statuses?.has(attacker.name) && move.category === "physical" ? 1.35 : 1;
  const hugePowerBoost =
    (attackerAbility?.id === "huge-power" || attackerAbility?.id === "pure-power") && move.category === "physical" ? 1.45 : 1;
  const fatReduction = effectiveDefenderAbility?.id === "thick-fat" && (move.type === "Fire" || move.type === "Ice") ? 0.7 : 1;
  const weatherBoost = weatherDamageMultiplier(move, activeWeather);
  const abilityPowerBoost = abilityDamageMultiplier(attacker, defender, move, attackerAbility, effectiveDefenderAbility, activeWeather, multiplier, statuses);
  const attackerStages = effectiveDefenderAbility?.id === "unaware" ? undefined : stages;
  const defenderStages = attackerAbility?.id === "unaware" ? undefined : stages;
  const attackStat =
    move.category === "physical"
      ? modifiedStat(attacker, "attack", attackerStages, statuses, attackerAbility, activeWeather) * burnAttackPenalty * gutsBoost * hugePowerBoost
      : move.category === "special"
        ? modifiedStat(attacker, "specialAttack", attackerStages, statuses, attackerAbility, activeWeather)
        : Math.max(
            modifiedStat(attacker, "attack", attackerStages, statuses, attackerAbility, activeWeather),
            modifiedStat(attacker, "specialAttack", attackerStages, statuses, attackerAbility, activeWeather),
          ) * 0.6;
  const defenseStat =
    move.category === "physical"
      ? modifiedStat(defender, "defense", defenderStages, statuses, effectiveDefenderAbility, activeWeather)
      : move.category === "special"
        ? modifiedStat(defender, "specialDefense", defenderStages, statuses, effectiveDefenderAbility, activeWeather)
        : Math.max(
            modifiedStat(defender, "defense", defenderStages, statuses, effectiveDefenderAbility, activeWeather),
            modifiedStat(defender, "specialDefense", defenderStages, statuses, effectiveDefenderAbility, activeWeather),
          );
  const power = move.power ?? 25;
  const accuracy = modifiedAccuracy(move, attackerAbility, effectiveDefenderAbility, statuses?.get(defender.name)?.condition, activeWeather);
  if (Math.random() > accuracy) {
    return { move, damage: 0, multiplier, missed: true, statusApplied: undefined, attackerStatusApplied: undefined, abilityNote: undefined };
  }

  const randomFactor = 0.88 + Math.random() * 0.16;
  const critical = isCriticalHit(move, attackerAbility, effectiveDefenderAbility, statuses?.get(defender.name)?.condition);
  const criticalBoost = critical ? (attackerAbility?.id === "sniper" ? 2.25 : 1.5) : 1;
  const raw =
    ((power * (attackStat / Math.max(35, defenseStat)) * stab * multiplier * fatReduction * weatherBoost * abilityPowerBoost * criticalBoost) /
      Math.max(40, defender.hp)) *
    18;
  let damage = clamp(Math.round(raw * randomFactor * bias), multiplier === 0 ? 0 : multiplier >= 2 ? 12 : 4, multiplier >= 4 ? 88 : 68);
  let abilityNote: string | undefined;
  const defenderHp = 100;
  if (effectiveDefenderAbility?.id === "sturdy" && damage >= defenderHp && !sturdyUsed?.has(defender.name)) {
    damage = 99;
    sturdyUsed?.add(defender.name);
    abilityNote = `${defender.displayName}의 옹골참! 아슬아슬하게 버텼다.`;
  }
  abilityNote = abilityNote ?? applyHitReactionAbility(attacker, defender, effectiveDefenderAbility, move, stages, critical);
  let statusApplied = inferMoveStatusEffect(move, defender, effectiveDefenderAbility, statuses, attackerAbility, activeWeather);
  if (!statusApplied && attackerAbility?.id === "poison-touch" && isContactMove(move) && !statuses?.has(defender.name) && Math.random() < 0.3) {
    statusApplied = "poison";
  }
  if (
    !statusApplied &&
    (attackerAbility?.id === "toxic-chain" || attackerAbility?.id === "poison-puppeteer") &&
    move.category !== "status" &&
    !statuses?.has(defender.name) &&
    Math.random() < 0.3
  ) {
    statusApplied = "poison";
  }
  let attackerStatusApplied = inferContactStatusEffect(move, attacker, attackerAbility, effectiveDefenderAbility, statuses);
  if (statusApplied === "poison" && defenderAbility?.id === "synchronize" && !statuses?.has(attacker.name)) attackerStatusApplied = "poison";
  if (statusApplied === "burn" && defenderAbility?.id === "synchronize" && !statuses?.has(attacker.name)) attackerStatusApplied = "burn";
  if (statusApplied === "paralysis" && defenderAbility?.id === "synchronize" && !statuses?.has(attacker.name)) attackerStatusApplied = "paralysis";
  if (statusApplied && defenderAbility?.id === "magic-bounce" && !statuses?.has(attacker.name)) {
    return { move, damage: 0, multiplier, missed: false, statusApplied: undefined, attackerStatusApplied: statusApplied, abilityNote: `${defender.displayName}의 ${defenderAbility.name}! 상태이상을 되돌렸다.` };
  }

  const attackerDamage = contactAbilityDamage(move, effectiveDefenderAbility, attackerAbility);
  return { move, damage, multiplier, missed: false, statusApplied, attackerStatusApplied, abilityNote, critical, attackerDamage };
}

function formatMoveDamage(
  attacker: Pokemon,
  defender: Pokemon,
  result: { move?: BattleMove; damage: number; multiplier: number; missed?: boolean; critical?: boolean },
  nextHp: number,
) {
  const moveName = result.move?.displayName ?? `${bestAttackLabel(attacker, defender)} 공격`;
  if (result.missed) {
    return `${attacker.displayName}의 ${moveName}! 그러나 빗나갔다!`;
  }

  const effectText = `${result.critical ? "급소에 맞았다! " : ""}${formatEffectText(result.multiplier)}`;
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

function applyEntryAbility(
  active: Pokemon | undefined,
  opponent: Pokemon | undefined,
  ability: BattleAbility | undefined,
  opponentAbility: BattleAbility | undefined,
  stages: Map<string, BattleStages>,
  weather: WeatherState,
  ownerName: string,
) {
  if (!active || !opponent || !ability) return [];
  const logs: string[] = [];

  if (ability.id === "intimidate") {
    if (preventsIntimidate(opponentAbility)) {
      logs.push(`${opponent.displayName}의 ${opponentAbility?.name}! 위협을 받아치지 않았다.`);
      return logs;
    }
    const opponentStages = stages.get(opponent.name) ?? emptyStages();
    opponentStages.attack = clamp(opponentStages.attack - 1, -6, 6);
    stages.set(opponent.name, opponentStages);
    logs.push(`${ownerName}, ${active.displayName}의 ${ability.name}! ${opponent.displayName}의 공격이 떨어졌다.`);
    if (opponentAbility?.id === "defiant") {
      opponentStages.attack = clamp(opponentStages.attack + 3, -6, 6);
      stages.set(opponent.name, opponentStages);
      logs.push(`${opponent.displayName}의 ${opponentAbility.name}! 공격이 크게 올랐다.`);
    }
    if (opponentAbility?.id === "competitive") {
      opponentStages.specialAttack = clamp(opponentStages.specialAttack + 2, -6, 6);
      stages.set(opponent.name, opponentStages);
      logs.push(`${opponent.displayName}의 ${opponentAbility.name}! 특공이 크게 올랐다.`);
    }
  }

  if (ability.id === "download") {
    const targetStat = opponent.defense <= opponent.specialDefense ? "attack" : "specialAttack";
    const currentStages = stages.get(active.name) ?? emptyStages();
    currentStages[targetStat] = clamp(currentStages[targetStat] + 1, -6, 6);
    stages.set(active.name, currentStages);
    logs.push(`${active.displayName}의 ${ability.name}! ${battleStatLabel(targetStat)}이 올랐다.`);
  }

  if (ability.id === "supersweet-syrup") {
    const opponentStages = stages.get(opponent.name) ?? emptyStages();
    opponentStages.speed = clamp(opponentStages.speed - 1, -6, 6);
    stages.set(opponent.name, opponentStages);
    logs.push(`${active.displayName}의 ${ability.name}! ${opponent.displayName}의 스피드가 떨어졌다.`);
  }

  const entryBoost = entryStageBoost(ability.id);
  if (entryBoost) {
    const currentStages = stages.get(active.name) ?? emptyStages();
    currentStages[entryBoost.stat] = clamp(currentStages[entryBoost.stat] + entryBoost.change, -6, 6);
    stages.set(active.name, currentStages);
    logs.push(`${active.displayName}의 ${ability.name}! ${battleStatLabel(entryBoost.stat)}이 올랐다.`);
  }

  const weatherSet = entryWeather(ability.id);
  if (weatherSet) {
    weather.condition = weatherSet.condition;
    weather.turns = 5;
    logs.push(`${active.displayName}의 ${ability.name}! ${weatherSet.label}`);
  }

  return logs;
}

function applySwitchOutAbility(
  mon: Pokemon,
  hp: Map<string, number>,
  statuses: Map<string, BattleStatusState>,
  ability: BattleAbility | undefined,
  ownerName: string,
) {
  const logs: string[] = [];
  if (ability?.id === "regenerator") {
    const nextHp = Math.min(100, (hp.get(mon.name) ?? 100) + 25);
    hp.set(mon.name, nextHp);
    logs.push(`${ownerName}, ${mon.displayName}의 ${ability.name}! HP를 ${nextHp}%까지 회복했다.`);
  }
  if (ability?.id === "natural-cure" && statuses.has(mon.name)) {
    statuses.delete(mon.name);
    logs.push(`${mon.displayName}의 ${ability.name}! 상태이상이 회복됐다.`);
  }
  return logs;
}

function applyKnockoutAbility(attacker: Pokemon, ability: BattleAbility | undefined, stages: Map<string, BattleStages>) {
  if (!ability) return undefined;
  const currentStages = stages.get(attacker.name) ?? emptyStages();
  if (ability.id === "moxie" || ability.id === "chilling-neigh" || ability.id === "as-one-glastrier") {
    currentStages.attack = clamp(currentStages.attack + 1, -6, 6);
    stages.set(attacker.name, currentStages);
    return `${attacker.displayName}의 ${ability.name}! 공격이 올랐다.`;
  }
  if (ability.id === "grim-neigh" || ability.id === "as-one-spectrier") {
    currentStages.specialAttack = clamp(currentStages.specialAttack + 1, -6, 6);
    stages.set(attacker.name, currentStages);
    return `${attacker.displayName}의 ${ability.name}! 특공이 올랐다.`;
  }
  if (ability.id === "soul-heart") {
    currentStages.specialAttack = clamp(currentStages.specialAttack + 1, -6, 6);
    stages.set(attacker.name, currentStages);
    return `${attacker.displayName}의 ${ability.name}! 특수공격이 올랐다.`;
  }
  if (ability.id === "beast-boost") {
    const stat = highestBattleStat(attacker);
    currentStages[stat] = clamp(currentStages[stat] + 1, -6, 6);
    stages.set(attacker.name, currentStages);
    return `${attacker.displayName}의 ${ability.name}! ${battleStatLabel(stat)}이 올랐다.`;
  }
  return undefined;
}

function applyHitReactionAbility(
  attacker: Pokemon,
  defender: Pokemon,
  ability: BattleAbility | undefined,
  move: BattleMove,
  stages?: Map<string, BattleStages>,
  critical = false,
) {
  if (!ability || !stages) return undefined;
  const currentStages = stages.get(defender.name) ?? emptyStages();
  const attackerStages = stages.get(attacker.name) ?? emptyStages();
  if (ability.id === "anger-point" && critical) {
    currentStages.attack = 6;
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 급소에 맞고 공격이 최대까지 올랐다.`;
  }
  if (ability.id === "weak-armor" && move.category === "physical") {
    currentStages.defense = clamp(currentStages.defense - 1, -6, 6);
    currentStages.speed = clamp(currentStages.speed + 2, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 방어가 떨어지고 스피드가 크게 올랐다.`;
  }
  if (ability.id === "stamina") {
    currentStages.defense = clamp(currentStages.defense + 1, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 방어가 올랐다.`;
  }
  if (ability.id === "justified" && move.type === "Dark") {
    currentStages.attack = clamp(currentStages.attack + 1, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 공격이 올랐다.`;
  }
  if (ability.id === "water-compaction" && move.type === "Water") {
    currentStages.defense = clamp(currentStages.defense + 2, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 방어가 크게 올랐다.`;
  }
  if (ability.id === "steam-engine" && (move.type === "Fire" || move.type === "Water")) {
    currentStages.speed = clamp(currentStages.speed + 3, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 스피드가 폭발적으로 올랐다.`;
  }
  if (ability.id === "rattled" && (move.type === "Bug" || move.type === "Ghost" || move.type === "Dark")) {
    currentStages.speed = clamp(currentStages.speed + 1, -6, 6);
    stages.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 스피드가 올랐다.`;
  }
  if (ability.id === "gooey" && isContactMove(move)) {
    attackerStages.speed = clamp(attackerStages.speed - 1, -6, 6);
    stages.set(attacker.name, attackerStages);
    return `${defender.displayName}의 ${ability.name}! ${attacker.displayName}의 스피드가 떨어졌다.`;
  }
  if (ability.id === "cotton-down" && isContactMove(move)) {
    attackerStages.speed = clamp(attackerStages.speed - 1, -6, 6);
    stages.set(attacker.name, attackerStages);
    return `${defender.displayName}의 ${ability.name}! ${attacker.displayName}의 스피드가 떨어졌다.`;
  }
  return undefined;
}

function beforeActionStatus(mon: Pokemon, statuses: Map<string, BattleStatusState>) {
  const state = statuses.get(mon.name);
  if (!state) return undefined;

  if (state.condition === "sleep") {
    state.turns -= 1;
    if (state.turns <= 0) {
      statuses.delete(mon.name);
      return `${mon.displayName}은 잠에서 깨어났다!`;
    }
    return `${mon.displayName}은 잠들어 움직일 수 없다.`;
  }

  if (state.condition === "freeze") {
    if (Math.random() < 0.28) {
      statuses.delete(mon.name);
      return `${mon.displayName}의 얼음이 녹았다!`;
    }
    return `${mon.displayName}은 얼어붙어 움직일 수 없다.`;
  }

  if (state.condition === "paralysis" && Math.random() < 0.18) {
    return `${mon.displayName}은 몸이 저려 움직일 수 없다.`;
  }

  if (state.condition === "confusion") {
    state.turns -= 1;
    if (state.turns <= 0) {
      statuses.delete(mon.name);
      return `${mon.displayName}의 혼란이 풀렸다!`;
    }
    if (Math.random() < 0.28) {
      return `${mon.displayName}은 혼란으로 자기 자신을 공격했다.`;
    }
  }

  return undefined;
}

function applyEndTurnStatus(
  playerActive: Pokemon | undefined,
  enemyActive: Pokemon | undefined,
  hp: Map<string, number>,
  statuses: Map<string, BattleStatusState>,
  stages: Map<string, BattleStages>,
  weather: WeatherState,
  abilityFor: (side: "player" | "enemy", mon: Pokemon) => BattleAbility | undefined,
) {
  const logs: string[] = [];
  const activePairs = [
    ["player", playerActive] as const,
    ["enemy", enemyActive] as const,
  ];

  activePairs.forEach(([side, mon]) => {
    if (!mon) return;
    const ability = abilityFor(side, mon);
    const status = statuses.get(mon.name)?.condition;
    if (status === "burn" || status === "poison") {
      if (ability?.id === "magic-guard") return;
      if (ability?.id === "poison-heal" && status === "poison") {
        const nextHp = Math.min(100, (hp.get(mon.name) ?? 100) + 10);
        hp.set(mon.name, nextHp);
        logs.push(`${mon.displayName}의 ${ability.name}! 독을 양분 삼아 HP를 ${nextHp}%까지 회복했다.`);
        return;
      }
      const damage = status === "burn" ? 6 : 8;
      const nextHp = Math.max(0, (hp.get(mon.name) ?? 100) - damage);
      hp.set(mon.name, nextHp);
      logs.push(`${mon.displayName}${subjectParticle(mon.displayName)} ${status === "burn" ? "화상" : "독"}으로 ${damage}% 피해를 입었다. 남은 HP ${nextHp}%.`);
    }

    if (ability?.id === "speed-boost") {
      const currentStages = stages.get(mon.name) ?? emptyStages();
      const before = currentStages.speed;
      currentStages.speed = clamp(currentStages.speed + 1, -6, 6);
      stages.set(mon.name, currentStages);
      if (currentStages.speed !== before) {
        logs.push(`${mon.displayName}의 ${ability.name}! 스피드가 올랐다.`);
      }
    }

    if ((ability?.id === "shed-skin" && statuses.has(mon.name) && Math.random() < 0.3) || (ability?.id === "hydration" && weather.condition === "rain")) {
      statuses.delete(mon.name);
      logs.push(`${mon.displayName}의 ${ability.name}! 상태이상이 회복됐다.`);
    }

    if (
      (ability?.id === "rain-dish" && weather.condition === "rain") ||
      (ability?.id === "ice-body" && weather.condition === "snow")
    ) {
      const nextHp = Math.min(100, (hp.get(mon.name) ?? 100) + 6);
      hp.set(mon.name, nextHp);
      logs.push(`${mon.displayName}의 ${ability.name}! HP를 ${nextHp}%까지 회복했다.`);
    }
    if (ability?.id === "grassy-surge" || ability?.id === "seed-sower" || ability?.id === "hospitality") {
      const nextHp = Math.min(100, (hp.get(mon.name) ?? 100) + 5);
      hp.set(mon.name, nextHp);
      logs.push(`${mon.displayName}의 ${ability.name}! HP를 ${nextHp}%까지 회복했다.`);
    }
  });

  if (playerActive && enemyActive) {
    const playerAbility = abilityFor("player", playerActive);
    const enemyAbility = abilityFor("enemy", enemyActive);
    if (playerAbility?.id === "bad-dreams" && statuses.get(enemyActive.name)?.condition === "sleep") {
      const nextHp = Math.max(0, (hp.get(enemyActive.name) ?? 100) - 8);
      hp.set(enemyActive.name, nextHp);
      logs.push(`${playerActive.displayName}의 ${playerAbility.name}! ${enemyActive.displayName}의 꿈을 갉아먹었다. 남은 HP ${nextHp}%.`);
    }
    if (enemyAbility?.id === "bad-dreams" && statuses.get(playerActive.name)?.condition === "sleep") {
      const nextHp = Math.max(0, (hp.get(playerActive.name) ?? 100) - 8);
      hp.set(playerActive.name, nextHp);
      logs.push(`${enemyActive.displayName}의 ${enemyAbility.name}! ${playerActive.displayName}의 꿈을 갉아먹었다. 남은 HP ${nextHp}%.`);
    }
  }

  if (weather.condition && weather.turns > 0) {
    weather.turns -= 1;
    if (weather.turns <= 0) {
      logs.push(`${weatherLabel(weather.condition)}이 걷혔다.`);
      weather.condition = undefined;
    }
  }

  return logs;
}

function abilityImmunity(
  defender: Pokemon,
  ability: BattleAbility | undefined,
  move: BattleMove,
  stages?: Map<string, BattleStages>,
) {
  if (!ability) return undefined;
  const currentStages = stages?.get(defender.name) ?? emptyStages();
  const typeMultiplier = bestAttackMultiplier([move.type], defender.types);
  if (ability.id === "wonder-guard" && typeMultiplier <= 1) return `${defender.displayName}의 ${ability.name}! 효과가 뛰어난 기술만 통한다.`;
  if (ability.id === "well-baked-body" && move.type === "Fire") {
    currentStages.defense = clamp(currentStages.defense + 2, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 불꽃을 막고 방어가 크게 올랐다.`;
  }
  if (ability.id === "flash-fire" && move.type === "Fire") return `${defender.displayName}의 ${ability.name}! 불꽃 공격을 무효화했다.`;
  if (ability.id === "levitate" && move.type === "Ground") return `${defender.displayName}의 ${ability.name}! 땅 공격을 피했다.`;
  if (ability.id === "water-absorb" && move.type === "Water") return `${defender.displayName}의 ${ability.name}! 물 공격을 흡수했다.`;
  if (ability.id === "volt-absorb" && move.type === "Electric") return `${defender.displayName}의 ${ability.name}! 전기 공격을 흡수했다.`;
  if (ability.id === "dry-skin" && move.type === "Water") return `${defender.displayName}의 ${ability.name}! 물 공격을 흡수했다.`;
  if (ability.id === "earth-eater" && move.type === "Ground") return `${defender.displayName}의 ${ability.name}! 땅 공격을 흡수했다.`;
  if (ability.id === "sap-sipper" && move.type === "Grass") {
    currentStages.attack = clamp(currentStages.attack + 1, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 풀 공격을 막고 공격이 올랐다.`;
  }
  if (ability.id === "thermal-exchange" && move.type === "Fire") {
    currentStages.attack = clamp(currentStages.attack + 1, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 열을 받아 공격이 올랐다.`;
  }
  if (ability.id === "lightning-rod" && move.type === "Electric") {
    currentStages.specialAttack = clamp(currentStages.specialAttack + 1, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 전기를 끌어모아 특공이 올랐다.`;
  }
  if (ability.id === "motor-drive" && move.type === "Electric") {
    currentStages.speed = clamp(currentStages.speed + 1, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 전기를 받아 스피드가 올랐다.`;
  }
  if (ability.id === "storm-drain" && move.type === "Water") {
    currentStages.specialAttack = clamp(currentStages.specialAttack + 1, -6, 6);
    stages?.set(defender.name, currentStages);
    return `${defender.displayName}의 ${ability.name}! 물을 끌어모아 특공이 올랐다.`;
  }
  if (ability.id === "soundproof" && isSoundMove(move)) return `${defender.displayName}의 ${ability.name}! 소리 기술을 막았다.`;
  if (ability.id === "bulletproof" && isBallMove(move)) return `${defender.displayName}의 ${ability.name}! 폭탄/구슬 기술을 막았다.`;
  return undefined;
}

function abilityDamageMultiplier(
  attacker: Pokemon,
  defender: Pokemon,
  move: BattleMove,
  attackerAbility: BattleAbility | undefined,
  defenderAbility: BattleAbility | undefined,
  weather?: WeatherState,
  typeMultiplier = bestAttackMultiplier([move.type], defender.types),
  statuses?: Map<string, BattleStatusState>,
) {
  let multiplier = 1;
  const hpRatioHint = attacker.hp <= 55 ? 0.33 : 1;
  const attackerStatus = statuses?.get(attacker.name)?.condition;
  if (attackerAbility?.id === "overgrow" && move.type === "Grass" && hpRatioHint <= 0.33) multiplier *= 1.5;
  if (attackerAbility?.id === "blaze" && move.type === "Fire" && hpRatioHint <= 0.33) multiplier *= 1.5;
  if (attackerAbility?.id === "torrent" && move.type === "Water" && hpRatioHint <= 0.33) multiplier *= 1.5;
  if (attackerAbility?.id === "swarm" && move.type === "Bug" && hpRatioHint <= 0.33) multiplier *= 1.5;
  if (attackerAbility?.id === "technician" && (move.power ?? 0) > 0 && (move.power ?? 0) <= 60) multiplier *= 1.5;
  if (attackerAbility?.id === "sheer-force" && moveStatusEffect(move)) multiplier *= 1.3;
  if (attackerAbility?.id === "iron-fist" && isPunchMove(move)) multiplier *= 1.2;
  if (attackerAbility?.id === "strong-jaw" && isBiteMove(move)) multiplier *= 1.5;
  if (attackerAbility?.id === "mega-launcher" && isPulseMove(move)) multiplier *= 1.5;
  if (attackerAbility?.id === "reckless" && isRecoilMove(move)) multiplier *= 1.2;
  if (attackerAbility?.id === "tough-claws" && isContactMove(move)) multiplier *= 1.25;
  if (attackerAbility?.id === "sharpness" && isSlicingMove(move)) multiplier *= 1.5;
  if (attackerAbility?.id === "punk-rock" && isSoundMove(move)) multiplier *= 1.3;
  if (attackerAbility?.id === "sand-force" && weather?.condition === "sand" && ["Rock", "Ground", "Steel"].includes(move.type)) multiplier *= 1.3;
  if (attackerAbility?.id === "solar-power" && weather?.condition === "sun" && move.category === "special") multiplier *= 1.35;
  if (attackerAbility?.id === "water-bubble" && move.type === "Water") multiplier *= 1.6;
  if (attackerAbility?.id === "tinted-lens" && typeMultiplier < 1 && typeMultiplier > 0) multiplier *= 2;
  if (attackerAbility?.id === "normalize" && move.type === "Normal") multiplier *= 1.2;
  if ((attackerAbility?.id === "pixilate" || attackerAbility?.id === "refrigerate") && (move.type === "Fairy" || move.type === "Ice")) {
    multiplier *= 1.2;
  }
  if (attackerAbility?.id === "liquid-voice" && move.type === "Water" && isSoundMove(move)) multiplier *= 1.2;
  if (attackerAbility?.id === "flare-boost" && attackerStatus === "burn" && move.category === "special") multiplier *= 1.5;
  if (attackerAbility?.id === "toxic-boost" && attackerStatus === "poison" && move.category === "physical") multiplier *= 1.5;
  if (attackerAbility?.id === "rivalry") {
    multiplier *= attacker.types.some((type) => defender.types.includes(type)) ? 1.15 : 0.9;
  }
  if (attackerAbility?.id === "analytic" && attacker.speed < defender.speed) multiplier *= 1.3;
  if (attackerAbility?.id === "fairy-aura" && move.type === "Fairy") multiplier *= defenderAbility?.id === "aura-break" ? 0.75 : 1.3;
  if (attackerAbility?.id === "dark-aura" && move.type === "Dark") multiplier *= defenderAbility?.id === "aura-break" ? 0.75 : 1.3;
  if (attackerAbility?.id === "stakeout") multiplier *= 1.15;
  if (attackerAbility?.id === "dragons-maw" && move.type === "Dragon") multiplier *= 1.5;
  if (attackerAbility?.id === "transistor" && move.type === "Electric") multiplier *= 1.3;
  if (attackerAbility?.id === "rocky-payload" && move.type === "Rock") multiplier *= 1.5;
  if (attackerAbility?.id === "gale-wings" && move.type === "Flying") multiplier *= 1.15;
  if (attackerAbility?.id === "triage" && isHealingMove(move)) multiplier *= 1.2;
  if (attackerAbility?.id === "steelworker" && move.type === "Steel") multiplier *= 1.5;
  if (attackerAbility?.id === "supreme-overlord") multiplier *= 1.12;
  if (attackerAbility?.id === "hadron-engine" && move.type === "Electric") multiplier *= 1.3;
  if (attackerAbility?.id === "orichalcum-pulse" && move.category === "physical") multiplier *= 1.3;
  if (attackerAbility?.id === "protosynthesis" || attackerAbility?.id === "quark-drive") multiplier *= 1.12;
  if (attackerAbility?.id === "electric-surge" && move.type === "Electric") multiplier *= 1.25;
  if (attackerAbility?.id === "grassy-surge" && move.type === "Grass") multiplier *= 1.25;
  if (attackerAbility?.id === "psychic-surge" && move.type === "Psychic") multiplier *= 1.25;
  if (attackerAbility?.id === "misty-surge" && move.type === "Fairy") multiplier *= 1.15;
  if (attackerAbility?.id === "sword-of-ruin" && move.category === "physical") multiplier *= 1.33;
  if (attackerAbility?.id === "beads-of-ruin" && move.category === "special") multiplier *= 1.33;
  if (defenderAbility?.id === "tablets-of-ruin" && move.category === "physical") multiplier *= 0.75;
  if (defenderAbility?.id === "vessel-of-ruin" && move.category === "special") multiplier *= 0.75;
  if (defenderAbility?.id === "filter" || defenderAbility?.id === "solid-rock" || defenderAbility?.id === "prism-armor") {
    if (typeMultiplier > 1) multiplier *= 0.75;
  }
  if (defenderAbility?.id === "punk-rock" && isSoundMove(move)) multiplier *= 0.5;
  if (defenderAbility?.id === "fluffy" && isContactMove(move)) multiplier *= move.type === "Fire" ? 1.2 : 0.65;
  if (defenderAbility?.id === "heatproof" && move.type === "Fire") multiplier *= 0.5;
  if (defenderAbility?.id === "water-bubble" && move.type === "Fire") multiplier *= 0.5;
  if (defenderAbility?.id === "fur-coat" && move.category === "physical") multiplier *= 0.5;
  if (defenderAbility?.id === "pressure") multiplier *= 0.95;
  if (defenderAbility?.id === "grass-pelt" && move.category === "physical") multiplier *= 0.8;
  if (defenderAbility?.id === "multitype" || defenderAbility?.id === "rks-system") multiplier *= 0.95;
  if (defenderAbility?.id === "ice-scales" && move.category === "special") multiplier *= 0.5;
  if (defenderAbility?.id === "purifying-salt" && move.type === "Ghost") multiplier *= 0.5;
  if (defenderAbility?.id === "multiscale" || defenderAbility?.id === "shadow-shield") multiplier *= 0.75;
  return multiplier;
}

function weatherDamageMultiplier(move: BattleMove, weather?: WeatherState) {
  if (weather?.condition === "rain") {
    if (move.type === "Water") return 1.35;
    if (move.type === "Fire") return 0.65;
  }
  if (weather?.condition === "sun") {
    if (move.type === "Fire") return 1.35;
    if (move.type === "Water") return 0.65;
  }
  return 1;
}

function applyMoveTypeAbility(move: BattleMove, ability?: BattleAbility): BattleMove {
  if (move.category === "status") return move;
  if (ability?.id === "normalize") return { ...move, type: "Normal" };
  if (ability?.id === "pixilate" && move.type === "Normal") return { ...move, type: "Fairy" };
  if (ability?.id === "refrigerate" && move.type === "Normal") return { ...move, type: "Ice" };
  if (ability?.id === "liquid-voice" && isSoundMove(move)) return { ...move, type: "Water" };
  return move;
}

function changesUserTypeForMove(ability: BattleAbility | undefined, move: BattleMove) {
  return (ability?.id === "protean" || ability?.id === "libero") && move.category !== "status";
}

function contactAbilityDamage(move: BattleMove, defenderAbility?: BattleAbility, attackerAbility?: BattleAbility) {
  if (!defenderAbility || !isContactMove(move) || attackerAbility?.id === "long-reach") return 0;
  if (defenderAbility.id === "rough-skin" || defenderAbility.id === "iron-barbs") return 8;
  if (defenderAbility.id === "liquid-ooze" && isHealingMove(move)) return 10;
  return 0;
}

function knockoutContactDamage(move: BattleMove | undefined, defenderAbility?: BattleAbility, attackerAbility?: BattleAbility) {
  if (!move || !defenderAbility || !isContactMove(move) || attackerAbility?.id === "long-reach") return 0;
  if (defenderAbility.id === "aftermath") return 16;
  return 0;
}

function modifiedAccuracy(
  move: BattleMove,
  attackerAbility?: BattleAbility,
  defenderAbility?: BattleAbility,
  defenderStatus?: StatusCondition,
  weather?: WeatherState,
) {
  if (attackerAbility?.id === "no-guard" || defenderAbility?.id === "no-guard") return 1;
  let accuracy = (move.accuracy ?? 100) / 100;
  const baseAccuracy = accuracy;
  if (attackerAbility?.id === "compound-eyes") accuracy *= 1.3;
  if (attackerAbility?.id === "victory-star") accuracy *= 1.1;
  if (attackerAbility?.id === "hustle" && move.category === "physical") accuracy *= 0.82;
  if (defenderAbility?.id === "wonder-skin" && move.category === "status") accuracy *= 0.5;
  if (defenderAbility?.id === "sand-veil" && weather?.condition === "sand") accuracy *= 0.8;
  if (defenderAbility?.id === "snow-cloak" && weather?.condition === "snow") accuracy *= 0.8;
  if (defenderAbility?.id === "tangled-feet" && defenderStatus === "confusion") accuracy *= 0.75;
  if (attackerAbility?.id === "keen-eye") accuracy = Math.max(accuracy, baseAccuracy);
  return clamp(accuracy, 0.05, 1);
}

function isCriticalHit(
  move: BattleMove,
  attackerAbility?: BattleAbility,
  defenderAbility?: BattleAbility,
  defenderStatus?: StatusCondition,
) {
  if (defenderAbility?.id === "battle-armor" || defenderAbility?.id === "shell-armor") return false;
  if (attackerAbility?.id === "merciless" && defenderStatus === "poison") return true;
  let chance = 0.08;
  if (attackerAbility?.id === "super-luck") chance += 0.12;
  if (isHighCritMove(move)) chance += 0.12;
  return Math.random() < clamp(chance, 0, 0.5);
}

function inferMoveStatusEffect(
  move: BattleMove,
  defender: Pokemon,
  defenderAbility: BattleAbility | undefined,
  statuses?: Map<string, BattleStatusState>,
  attackerAbility?: BattleAbility,
  weather?: WeatherState,
): StatusCondition | undefined {
  if (statuses?.has(defender.name)) return undefined;
  const effect = moveStatusEffect(move);
  if (!effect) return undefined;
  if (defenderAbility?.id === "shield-dust") return undefined;
  if (defenderAbility?.id === "good-as-gold" && move.category === "status") return undefined;
  if (defenderAbility?.id === "purifying-salt") return undefined;
  if (defenderAbility?.id === "leaf-guard" && weather?.condition === "sun") return undefined;
  if (defenderAbility?.id === "overcoat" && isPowderMove(move)) return undefined;
  const chance = attackerAbility?.id === "serene-grace" ? Math.min(1, effect.chance * 2) : effect.chance;
  if (Math.random() > chance) return undefined;
  if (defenderAbility?.id === "immunity" && effect.condition === "poison") return undefined;
  if (defenderAbility?.id === "limber" && effect.condition === "paralysis") return undefined;
  if ((defenderAbility?.id === "insomnia" || defenderAbility?.id === "vital-spirit" || defenderAbility?.id === "sweet-veil") && effect.condition === "sleep") return undefined;
  if (defenderAbility?.id === "water-veil" && effect.condition === "burn") return undefined;
  if (defenderAbility?.id === "magma-armor" && effect.condition === "freeze") return undefined;
  if (defenderAbility?.id === "own-tempo" && effect.condition === "confusion") return undefined;
  if (defender.types.includes("Fire") && effect.condition === "burn") return undefined;
  if (
    (defender.types.includes("Poison") || defender.types.includes("Steel")) &&
    effect.condition === "poison" &&
    attackerAbility?.id !== "corrosion"
  ) return undefined;
  if (defender.types.includes("Electric") && effect.condition === "paralysis") return undefined;
  if (defender.types.includes("Ice") && effect.condition === "freeze") return undefined;
  return effect.condition;
}

function inferContactStatusEffect(
  move: BattleMove,
  attacker: Pokemon,
  attackerAbility: BattleAbility | undefined,
  defenderAbility: BattleAbility | undefined,
  statuses?: Map<string, BattleStatusState>,
): StatusCondition | undefined {
  if (!defenderAbility || !isContactMove(move) || attackerAbility?.id === "long-reach" || statuses?.has(attacker.name)) return undefined;
  if (defenderAbility.id === "static" && Math.random() < 0.3) return "paralysis";
  if (defenderAbility.id === "flame-body" && Math.random() < 0.3) return "burn";
  if (defenderAbility.id === "poison-point" && Math.random() < 0.3) return "poison";
  if (defenderAbility.id === "cute-charm" && Math.random() < 0.2) return "confusion";
  if (defenderAbility.id === "cursed-body" && Math.random() < 0.3) return "confusion";
  if (defenderAbility.id === "toxic-debris" && Math.random() < 0.3) return "poison";
  if (defenderAbility.id === "effect-spore" && Math.random() < 0.3) return randomItem(["poison", "paralysis", "sleep"] as StatusCondition[]);
  return undefined;
}

function moveStatusEffect(move: BattleMove): { condition: StatusCondition; chance: number } | undefined {
  const name = move.name.toLowerCase();
  if (name.includes("will-o-wisp") || name.includes("scald")) return { condition: "burn", chance: 1 };
  if (name.includes("thunder-wave") || name.includes("stun-spore") || name.includes("nuzzle")) {
    return { condition: "paralysis", chance: 1 };
  }
  if (name.includes("toxic") || name.includes("poison-powder")) return { condition: "poison", chance: 1 };
  if (name.includes("sleep-powder") || name.includes("hypnosis") || name.includes("spore")) return { condition: "sleep", chance: 1 };
  if (name.includes("confuse-ray") || name.includes("supersonic")) return { condition: "confusion", chance: 1 };
  if (move.type === "Fire" && move.category !== "status") return { condition: "burn", chance: move.power && move.power >= 100 ? 0.2 : 0.1 };
  if (move.type === "Electric" && move.category !== "status") return { condition: "paralysis", chance: 0.1 };
  if (move.type === "Poison" && move.category !== "status") return { condition: "poison", chance: 0.25 };
  if (move.type === "Ice" && move.category !== "status") return { condition: "freeze", chance: 0.1 };
  return undefined;
}

function entryWeather(abilityId: string): { condition: WeatherCondition; label: string } | undefined {
  if (abilityId === "orichalcum-pulse") return { condition: "sun", label: "고대의 맥동으로 햇살이 강해졌다." };
  if (abilityId === "sand-spit") return { condition: "sand", label: "모래가 흩날리기 시작했다." };
  if (abilityId === "drizzle") return { condition: "rain", label: "비가 내리기 시작했다." };
  if (abilityId === "drought") return { condition: "sun", label: "햇살이 강해졌다." };
  if (abilityId === "sand-stream") return { condition: "sand", label: "모래바람이 불기 시작했다." };
  if (abilityId === "snow-warning") return { condition: "snow", label: "눈이 내리기 시작했다." };
  return undefined;
}

function entryStageBoost(abilityId: string): { stat: BattleStat; change: number } | undefined {
  if (abilityId === "hadron-engine") return { stat: "specialAttack", change: 1 };
  if (abilityId === "guard-dog") return { stat: "attack", change: 1 };
  if (abilityId === "intrepid-sword") return { stat: "attack", change: 1 };
  if (abilityId === "dauntless-shield") return { stat: "defense", change: 1 };
  return undefined;
}

function preventsIntimidate(ability: BattleAbility | undefined) {
  return ["inner-focus", "own-tempo", "oblivious", "scrappy", "clear-body", "white-smoke", "full-metal-body", "hyper-cutter", "big-pecks", "guard-dog", "mirror-armor"].includes(
    ability?.id ?? "",
  );
}

function ignoresDefensiveAbility(ability: BattleAbility | undefined) {
  return ability?.id === "mold-breaker" || ability?.id === "teravolt" || ability?.id === "turboblaze";
}

function suppressesWeather(ability: BattleAbility | undefined) {
  return ability?.id === "cloud-nine" || ability?.id === "air-lock";
}

function weatherLabel(condition: WeatherCondition) {
  if (condition === "rain") return "비";
  if (condition === "sun") return "강한 햇살";
  if (condition === "sand") return "모래바람";
  return "눈";
}

function highestBattleStat(mon: Pokemon): BattleStat {
  const stats: Array<[BattleStat, number]> = [
    ["attack", mon.attack],
    ["defense", mon.defense],
    ["specialAttack", mon.specialAttack],
    ["specialDefense", mon.specialDefense],
    ["speed", mon.speed],
  ];
  return stats.sort((a, b) => b[1] - a[1])[0][0];
}

function isContactMove(move: BattleMove) {
  if (move.category !== "physical") return false;
  const name = move.name.toLowerCase();
  return !["beam", "blast", "shot", "rock", "quake", "spike", "bomb"].some((token) => name.includes(token));
}

function isPunchMove(move: BattleMove) {
  return move.name.toLowerCase().includes("punch");
}

function isBiteMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return name.includes("bite") || name.includes("fang") || name.includes("crunch");
}

function isPulseMove(move: BattleMove) {
  return move.name.toLowerCase().includes("pulse") || move.name.toLowerCase().includes("aura-sphere");
}

function isRecoilMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return ["double-edge", "flare-blitz", "brave-bird", "head-smash", "wild-charge", "wood-hammer", "volt-tackle"].some((token) =>
    name.includes(token),
  );
}

function isSlicingMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return ["slash", "cut", "blade", "cutter", "scythe", "sacred-sword"].some((token) => name.includes(token));
}

function isHighCritMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return [
    "slash",
    "leaf-blade",
    "night-slash",
    "cross-chop",
    "stone-edge",
    "drill-run",
    "psycho-cut",
    "shadow-claw",
    "razor-leaf",
    "air-cutter",
  ].some((token) => name.includes(token));
}

function isSoundMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return ["sound", "voice", "song", "boomburst", "hyper-voice", "bug-buzz", "snarl", "uproar", "screech"].some((token) =>
    name.includes(token),
  );
}

function isHealingMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return ["heal", "recover", "roost", "synthesis", "moonlight", "morning-sun", "soft-boiled", "wish", "draining"].some((token) =>
    name.includes(token),
  );
}

function isBallMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return ["ball", "bomb", "blast", "barrage", "bullet", "seed"].some((token) => name.includes(token));
}

function isPowderMove(move: BattleMove) {
  const name = move.name.toLowerCase();
  return name.includes("powder") || name.includes("spore") || name.includes("cotton-spore") || name.includes("stun-spore");
}

function initialStatusTurns(condition: StatusCondition, ability?: BattleAbility) {
  if (condition === "sleep") return ability?.id === "early-bird" ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
  if (condition === "confusion") return 2 + Math.floor(Math.random() * 3);
  return 0;
}

function statusLabel(condition: StatusCondition) {
  if (condition === "burn") return "화상";
  if (condition === "poison") return "독";
  if (condition === "paralysis") return "마비";
  if (condition === "sleep") return "잠듦";
  if (condition === "freeze") return "얼음";
  return "혼란";
}

function subjectParticle(label: string) {
  const last = label[label.length - 1];
  const code = last.charCodeAt(0);
  const hasFinalConsonant = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return hasFinalConsonant ? "은" : "는";
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

function modifiedStat(
  mon: Pokemon,
  stat: BattleStat,
  stages?: Map<string, BattleStages>,
  statuses?: Map<string, BattleStatusState>,
  ability?: BattleAbility,
  weather?: WeatherState,
) {
  const base = mon[stat];
  const rawStage = stages?.get(mon.name)?.[stat] ?? 0;
  const stage = ability?.id === "simple" ? clamp(rawStage * 2, -6, 6) : rawStage;
  const status = statuses?.get(mon.name)?.condition;
  const paralysisPenalty = stat === "speed" && status === "paralysis" && ability?.id !== "limber" ? 0.55 : 1;
  const marvelScaleBoost = stat === "defense" && Boolean(status) && ability?.id === "marvel-scale" ? 1.35 : 1;
  const weatherSpeedBoost =
    stat === "speed" &&
    ((ability?.id === "swift-swim" && weather?.condition === "rain") ||
      (ability?.id === "chlorophyll" && weather?.condition === "sun") ||
      (ability?.id === "sand-rush" && weather?.condition === "sand") ||
      (ability?.id === "slush-rush" && weather?.condition === "snow"))
      ? 1.8
      : 1;
  const quickFeetBoost = stat === "speed" && Boolean(status) && ability?.id === "quick-feet" ? 1.5 : 1;
  const unburdenBoost = stat === "speed" && ability?.id === "unburden" ? 1.25 : 1;
  const slowStartPenalty = ability?.id === "slow-start" && (stat === "attack" || stat === "speed") ? 0.6 : 1;
  const defeatistPenalty = ability?.id === "defeatist" && (stat === "attack" || stat === "specialAttack") ? 0.75 : 1;
  const flowerGiftBoost =
    ability?.id === "flower-gift" && weather?.condition === "sun" && (stat === "attack" || stat === "specialDefense") ? 1.35 : 1;
  const weightAbilityBoost =
    (ability?.id === "heavy-metal" && stat === "defense") || (ability?.id === "light-metal" && stat === "speed") ? 1.12 : 1;
  return (
    base *
    stageMultiplier(stage) *
    paralysisPenalty *
    marvelScaleBoost *
    weatherSpeedBoost *
    quickFeetBoost *
    unburdenBoost *
    slowStartPenalty *
    defeatistPenalty *
    flowerGiftBoost *
    weightAbilityBoost
  );
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

function actionPriority(attackerAbility: BattleAbility | undefined, move: BattleMove | undefined, defenderAbility: BattleAbility | undefined) {
  if (!move) return 0;
  let priority = 0;
  if (attackerAbility?.id === "prankster" && move.category === "status") priority += 1;
  if (attackerAbility?.id === "triage" && isHealingMove(move)) priority += 3;
  if (attackerAbility?.id === "gale-wings" && move.type === "Flying") priority += 1;
  if (priority > 0 && blocksPriority(defenderAbility)) return 0;
  return priority;
}

function blocksPriority(ability: BattleAbility | undefined) {
  return ability?.id === "armor-tail" || ability?.id === "dazzling" || ability?.id === "queenly-majesty";
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

export const typeChart: Record<TypeName, Partial<Record<TypeName, number>>> = {
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
