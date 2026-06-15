import React from "react";
import ReactDOM from "react-dom/client";
import { RotateCcw, Swords } from "lucide-react";
import "./styles.css";
import { calculateWinProjection, createBattleFeed, typeChart, type MoveSet } from "./battle";
import { championLeagues, type LeagueOpponent } from "./leagues";
import {
  buildChoices,
  buildEnemyTeam,
  generationLabels,
  pokemon,
  teamPower,
  typeColors,
  typeGradient,
  typeLabels,
  type DraftRule,
  type BattleAbility,
  type BattleMove,
  type MatchResult,
  type Pokemon,
  type StatusCondition,
} from "./model";

const rounds = ["16강", "8강", "4강", "결승"] as const;
type GameMode = "random" | "champions" | "manual";
const logSpeeds = [0.5, 0.75, 1, 1.5, 2] as const;
type LogSpeed = (typeof logSpeeds)[number];
type ShowdownMoveRequest = {
  move: string;
  id: string;
  pp?: number;
  maxpp?: number;
  disabled?: boolean;
};
type ShowdownPokemonRequest = {
  ident: string;
  condition: string;
  active?: boolean;
  ability?: string;
  baseAbility?: string;
  moves?: string[];
};
type ShowdownSideRequest = {
  pokemon: ShowdownPokemonRequest[];
};
type ShowdownRequest = {
  wait?: boolean;
  forceSwitch?: boolean[];
  active?: Array<{
    moves?: ShowdownMoveRequest[];
  }>;
  side?: ShowdownSideRequest;
};
type ManualBattleState = {
  battleId?: string;
  enemy: Pokemon[];
  enemyMoves: MoveSet;
  enemyAbilities: Record<string, BattleAbility>;
  playerHp: Record<string, number>;
  enemyHp: Record<string, number>;
  playerActive: string;
  enemyActive: string;
  chunks: string[];
  logs: string[];
  request?: ShowdownRequest;
  status: "loading" | "ready" | "error";
  pending?: boolean;
  error?: string;
  result?: "win" | "lose";
};
const buildShowdownApiBase = import.meta.env.VITE_SHOWDOWN_API_URL?.trim();
const implementedAbilityIds = new Set([
  "adaptability",
  "aftermath",
  "armor-tail",
  "bad-dreams",
  "big-pecks",
  "electric-surge",
  "dazzling",
  "gale-wings",
  "grass-pelt",
  "grassy-surge",
  "guard-dog",
  "hadron-engine",
  "heavy-metal",
  "hospitality",
  "iron-barbs",
  "libero",
  "light-metal",
  "liquid-voice",
  "liquid-ooze",
  "long-reach",
  "mirror-armor",
  "misty-surge",
  "multitype",
  "normalize",
  "orichalcum-pulse",
  "pixilate",
  "poison-puppeteer",
  "pressure",
  "prankster",
  "protean",
  "protosynthesis",
  "psychic-surge",
  "purifying-salt",
  "queenly-majesty",
  "quark-drive",
  "refrigerate",
  "rks-system",
  "rough-skin",
  "sand-spit",
  "seed-sower",
  "simple",
  "sniper",
  "soul-heart",
  "supersweet-syrup",
  "supreme-overlord",
  "thermal-exchange",
  "toxic-chain",
  "toxic-debris",
  "triage",
  "well-baked-body",
  "wonder-guard",
  "air-lock",
  "analytic",
  "anger-point",
  "arena-trap",
  "as-one-glastrier",
  "as-one-spectrier",
  "aura-break",
  "battle-armor",
  "beast-boost",
  "beads-of-ruin",
  "blaze",
  "bulletproof",
  "chlorophyll",
  "chilling-neigh",
  "clear-body",
  "cloud-nine",
  "compound-eyes",
  "competitive",
  "corrosion",
  "cotton-down",
  "cursed-body",
  "cute-charm",
  "dark-aura",
  "dauntless-shield",
  "defeatist",
  "defiant",
  "download",
  "dragons-maw",
  "drought",
  "drizzle",
  "dry-skin",
  "earth-eater",
  "early-bird",
  "effect-spore",
  "fairy-aura",
  "filter",
  "flare-boost",
  "flame-body",
  "flash-fire",
  "flower-gift",
  "fluffy",
  "full-metal-body",
  "fur-coat",
  "gooey",
  "good-as-gold",
  "grim-neigh",
  "guts",
  "heatproof",
  "huge-power",
  "hyper-cutter",
  "hydration",
  "hustle",
  "ice-body",
  "ice-scales",
  "immunity",
  "inner-focus",
  "insomnia",
  "intimidate",
  "iron-fist",
  "intrepid-sword",
  "justified",
  "keen-eye",
  "leaf-guard",
  "levitate",
  "lightning-rod",
  "limber",
  "magic-bounce",
  "magma-armor",
  "magnet-pull",
  "marvel-scale",
  "mega-launcher",
  "merciless",
  "magic-guard",
  "motor-drive",
  "mold-breaker",
  "moxie",
  "multiscale",
  "natural-cure",
  "no-guard",
  "overgrow",
  "overcoat",
  "oblivious",
  "own-tempo",
  "poison-heal",
  "poison-point",
  "poison-touch",
  "prism-armor",
  "punk-rock",
  "pure-power",
  "quick-feet",
  "rain-dish",
  "rattled",
  "reckless",
  "regenerator",
  "rivalry",
  "rocky-payload",
  "sand-force",
  "sand-rush",
  "sand-stream",
  "sand-veil",
  "sap-sipper",
  "scrappy",
  "serene-grace",
  "shadow-tag",
  "shadow-shield",
  "sharpness",
  "shed-skin",
  "sheer-force",
  "shield-dust",
  "shell-armor",
  "slush-rush",
  "slow-start",
  "snow-warning",
  "snow-cloak",
  "solar-power",
  "solid-rock",
  "soundproof",
  "speed-boost",
  "stamina",
  "stakeout",
  "static",
  "steelworker",
  "steam-engine",
  "storm-drain",
  "strong-jaw",
  "sturdy",
  "super-luck",
  "swarm",
  "sweet-veil",
  "sword-of-ruin",
  "swift-swim",
  "synchronize",
  "tablets-of-ruin",
  "tangled-feet",
  "technician",
  "thick-fat",
  "tinted-lens",
  "toxic-boost",
  "torrent",
  "tough-claws",
  "transistor",
  "teravolt",
  "turboblaze",
  "unaware",
  "unburden",
  "vital-spirit",
  "vessel-of-ruin",
  "volt-absorb",
  "water-absorb",
  "water-bubble",
  "water-compaction",
  "water-veil",
  "white-smoke",
  "victory-star",
  "weak-armor",
  "wonder-skin",
]);
const passiveAbilityIds = new Set([
  "anticipation",
  "aroma-veil",
  "ball-fetch",
  "battery",
  "cheek-pouch",
  "commander",
  "costar",
  "curious-medicine",
  "damp",
  "emergency-exit",
  "flower-veil",
  "forewarn",
  "friend-guard",
  "frisk",
  "gluttony",
  "gulp-missile",
  "harvest",
  "healer",
  "honey-gather",
  "illuminate",
  "innards-out",
  "klutz",
  "magician",
  "minus",
  "mimicry",
  "neutralizing-gas",
  "pastel-veil",
  "pickup",
  "pickpocket",
  "plus",
  "power-spot",
  "propeller-tail",
  "receiver",
  "ripen",
  "run-away",
  "schooling",
  "stall",
  "sticky-hold",
  "stalwart",
  "steely-spirit",
  "suction-cups",
  "symbiosis",
  "telepathy",
  "unnerve",
  "wandering-spirit",
]);

function App() {
  const [mode, setMode] = React.useState<GameMode>("random");
  const [team, setTeam] = React.useState<Pokemon[]>([]);
  const [rule, setRule] = React.useState<DraftRule>(() => rollRule());
  const [choices, setChoices] = React.useState<Pokemon[]>(() => buildChoices(rule, []));
  const [matches, setMatches] = React.useState<MatchResult[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);
  const [visibleLogCount, setVisibleLogCount] = React.useState(1);
  const [teamMoves, setTeamMoves] = React.useState<Record<string, BattleMove[]>>({});
  const [choiceMoves, setChoiceMoves] = React.useState<Record<string, BattleMove[]>>({});
  const [teamAbilities, setTeamAbilities] = React.useState<Record<string, BattleAbility>>({});
  const [choiceAbilities, setChoiceAbilities] = React.useState<Record<string, BattleAbility>>({});
  const [selectedMovePokemon, setSelectedMovePokemon] = React.useState<string | null>(null);
  const [inspectingChoice, setInspectingChoice] = React.useState<Pokemon | null>(null);
  const [manualBattle, setManualBattle] = React.useState<ManualBattleState | null>(null);
  const [logSpeed, setLogSpeed] = React.useState<LogSpeed>(1);
  const [sameGenRerolls, setSameGenRerolls] = React.useState(2);
  const [wildRerolls, setWildRerolls] = React.useState(2);

  const pickNumber = team.length + 1;
  const isDrafting = team.length < 6;
  const activeMatch = matches[activeMatchIndex];
  const activeLogs = activeMatch && !activeMatch.skipped ? activeMatch.logs.slice(0, visibleLogCount) : [];
  const isLogDone = Boolean(activeMatch && !activeMatch.skipped && visibleLogCount >= activeMatch.logs.length);
  const runEnded = Boolean(
    activeMatch && !activeMatch.skipped && isLogDone && (!activeMatch.win || activeMatchIndex === matches.length - 1),
  );
  const isRevealed = runEnded;
  const champion = runEnded && Boolean(activeMatch && !activeMatch.skipped && activeMatch.win);
  const modeLabel = mode === "random" ? "랜덤 토너먼트" : mode === "champions" ? "포챔스" : "직접 전투";
  const regionLabel =
    mode === "champions" && activeMatch && !activeMatch.skipped
      ? activeMatch.revealRegion
        ? `${activeMatch.leagueRegion} 리그`
        : "??? 리그"
      : modeLabel;

  React.useEffect(() => {
    setVisibleLogCount(1);
  }, [matches, activeMatchIndex]);

  React.useEffect(() => {
    setChoiceMoves(buildMoveSet(choices));
    setChoiceAbilities(buildAbilitySet(choices));
  }, [choices]);

  React.useEffect(() => {
    if (!activeMatch || activeMatch.skipped || visibleLogCount >= activeMatch.logs.length) return;

    const timer = window.setTimeout(() => {
      setVisibleLogCount((count) => Math.min(count + 1, activeMatch.logs.length));
    }, 680 / logSpeed);

    return () => window.clearTimeout(timer);
  }, [activeMatch, visibleLogCount, logSpeed]);

  async function startManualBattle() {
    const loadingBattle = createManualBattle(team);
    setManualBattle(loadingBattle);
    setMatches([]);

    try {
      const response = await postShowdown("/battle/start", {
        team,
        enemy: loadingBattle.enemy,
        playerMoves: teamMoves,
        enemyMoves: loadingBattle.enemyMoves,
        playerAbilities: teamAbilities,
        enemyAbilities: loadingBattle.enemyAbilities,
        seed: randomShowdownSeed(),
      });
      setManualBattle(manualBattleFromShowdown(loadingBattle, response.battleId, response.chunks));
    } catch (error) {
      setManualBattle({
        ...loadingBattle,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        logs: [...loadingBattle.logs, `Showdown API 연결 실패: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  async function submitManualChoice(choice: string) {
    const battle = manualBattle;
    if (!battle?.battleId || battle.pending || battle.status !== "ready") return;

    setManualBattle({ ...battle, pending: true });
    try {
      const response = await postShowdown(`/battle/${battle.battleId}/player-action`, { choice });
      setManualBattle(manualBattleFromShowdown({ ...battle, pending: false }, battle.battleId, response.chunks));
    } catch (error) {
      setManualBattle({
        ...battle,
        pending: false,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        logs: [...battle.logs, `Showdown API 선택 실패: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  function startRun() {
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, []);
    setTeam([]);
    setMatches([]);
    setManualBattle(null);
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
    setTeamMoves({});
    setTeamAbilities({});
    setChoiceMoves(buildMoveSet(nextChoices));
    setChoiceAbilities(buildAbilitySet(nextChoices));
    setSelectedMovePokemon(null);
    setInspectingChoice(null);
    setSameGenRerolls(2);
    setWildRerolls(2);
    setRule(nextRule);
    setChoices(nextChoices);
  }

  function pickPokemon(mon: Pokemon) {
    const nextTeam = [...team, mon];
    setTeam(nextTeam);
    setInspectingChoice(null);
    setTeamMoves((current) => ({
      ...current,
      [mon.name]: current[mon.name] ?? choiceMoves[mon.name] ?? rollMoves(mon),
    }));
    setTeamAbilities((current) => ({
      ...current,
      [mon.name]: current[mon.name] ?? choiceAbilities[mon.name] ?? rollAbility(mon),
    }));
    setSelectedMovePokemon(mon.name);

    if (nextTeam.length >= 6) {
      setActiveMatchIndex(0);
      setVisibleLogCount(1);
      return;
    }

    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, nextTeam);
    setRule(nextRule);
    setChoices(nextChoices);
    setChoiceMoves(buildMoveSet(nextChoices));
    setChoiceAbilities(buildAbilitySet(nextChoices));
  }

  function simulateAgain() {
    if (mode === "manual") {
      void startManualBattle();
      return;
    }
    setMatches(simulateRun(team, mode, teamMoves, teamAbilities));
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
  }

  function startBattle() {
    if (mode === "manual") {
      void startManualBattle();
      return;
    }
    setMatches(simulateRun(team, mode, teamMoves, teamAbilities));
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, []);
    setTeam([]);
    setMatches([]);
    setManualBattle(null);
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
    setTeamMoves({});
    setTeamAbilities({});
    setChoiceMoves(buildMoveSet(nextChoices));
    setChoiceAbilities(buildAbilitySet(nextChoices));
    setSelectedMovePokemon(null);
    setInspectingChoice(null);
    setSameGenRerolls(2);
    setWildRerolls(2);
    setRule(nextRule);
    setChoices(nextChoices);
  }

  function goNextBattle() {
    setActiveMatchIndex((index) => Math.min(index + 1, matches.length - 1));
    setVisibleLogCount(1);
  }

  function rerollSameGeneration() {
    if (sameGenRerolls <= 0 || !isDrafting) return;
    const nextChoices = buildChoices(rule, team);
    setInspectingChoice(null);
    setChoices(nextChoices);
    setChoiceMoves(buildMoveSet(nextChoices));
    setChoiceAbilities(buildAbilitySet(nextChoices));
    setSameGenRerolls((count) => count - 1);
  }

  function rerollAnyGeneration() {
    if (wildRerolls <= 0 || !isDrafting) return;
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, team);
    setInspectingChoice(null);
    setRule(nextRule);
    setChoices(nextChoices);
    setChoiceMoves(buildMoveSet(nextChoices));
    setChoiceAbilities(buildAbilitySet(nextChoices));
    setWildRerolls((count) => count - 1);
  }

  return (
    <main className="app">
      <section className="topbar" aria-label="게임 상태">
        <div>
          <p className="eyebrow">팬 드래프트 배틀</p>
          <h1>타입 드래프트 아레나</h1>
        </div>
        <div className="mode-switch" aria-label="게임 모드">
          <button className={mode === "random" ? "active" : ""} type="button" onClick={() => changeMode("random")}>
            랜덤 토너먼트
          </button>
          <button className={mode === "champions" ? "active" : ""} type="button" onClick={() => changeMode("champions")}>
            포챔스
          </button>
          <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => changeMode("manual")}>
            직접 전투
          </button>
        </div>
        <div className="status-strip">
          <Status label="선택" value={isDrafting ? `${pickNumber} / 6` : "완성"} />
          <Status label="모드" value={modeLabel} />
          {!isDrafting && matches.length > 0 && <Status label="리그" value={regionLabel} />}
          <Status label="조건" value={`${rule.gen}세대 ${generationLabels[rule.gen]}`} />
          <button className="primary-action" type="button" onClick={startRun}>
            <RotateCcw size={18} />
            새로 시작
          </button>
        </div>
      </section>

      <section className={matches.length > 0 || manualBattle ? "board battle-board" : "board"}>
        {matches.length === 0 && !manualBattle && (
          <aside className="team-panel" aria-label="내 파티">
            <div className="panel-heading">
              <h2>내 파티</h2>
              <span>{isRevealed ? `${Math.round(teamPower(team))}점` : "비공개"}</span>
            </div>
            <div className="team-slots">
              {Array.from({ length: 6 }, (_, index) => {
                const mon = team[index];
                return mon ? <TeamSlot key={mon.name} pokemon={mon} /> : <EmptySlot key={index} index={index + 1} />;
              })}
            </div>
          </aside>
        )}

        {matches.length === 0 && !manualBattle ? (
          <section className="draft-panel">
            <div className="draft-heading">
              <div>
                <p className="eyebrow">랜덤 조건</p>
                <h2>{isDrafting ? `${pickNumber}번째 파티원을 고르세요` : "파티 선택 완료"}</h2>
              </div>
              <div className="rule-card">
                <span>{rule.gen}세대 {generationLabels[rule.gen]}</span>
                <strong>세대 랜덤 5마리</strong>
              </div>
            </div>
            {isDrafting && (
              <div className="reroll-row">
                <button type="button" onClick={rerollSameGeneration} disabled={sameGenRerolls <= 0}>
                  세대 내 리롤 {sameGenRerolls}
                </button>
                <button type="button" onClick={rerollAnyGeneration} disabled={wildRerolls <= 0}>
                  완전 랜덤 리롤 {wildRerolls}
                </button>
              </div>
            )}
            <div className="choices" aria-live="polite">
              {isDrafting
                ? choices.map((mon) => <ChoiceCard key={mon.name} pokemon={mon} onInspect={setInspectingChoice} />)
                : (
                    <LockedParty
                      team={team}
                      teamMoves={teamMoves}
                      teamAbilities={teamAbilities}
                      selectedPokemonName={selectedMovePokemon ?? team[0]?.name ?? null}
                      onSelectPokemon={setSelectedMovePokemon}
                      onStartBattle={startBattle}
                    />
                  )}
            </div>
            {inspectingChoice && (
              <ChoiceMoveModal
                pokemon={inspectingChoice}
                moves={choiceMoves[inspectingChoice.name] ?? []}
                ability={choiceAbilities[inspectingChoice.name] ?? rollAbility(inspectingChoice)}
                onClose={() => setInspectingChoice(null)}
                onPick={() => pickPokemon(inspectingChoice)}
              />
            )}
          </section>
        ) : manualBattle ? (
          <ManualBattleView
            battle={manualBattle}
            team={team}
            teamAbilities={teamAbilities}
            onChoose={(choice) => void submitManualChoice(choice)}
            onRestart={() => void startManualBattle()}
          />
        ) : (
          <section className="tournament" aria-label="도전 결과">
            <div className="tournament-heading">
              <div>
                <p className="eyebrow">{mode === "random" ? "챔피언 도전" : "포챔스 도전"}</p>
                <h2>{runEnded ? (champion ? (mode === "random" ? "우승 성공" : "포챔스 제패") : "탈락") : "도전 진행 중"}</h2>
              </div>
              <div className="speed-control" aria-label="로그 속도">
                {logSpeeds.map((speed) => (
                  <button className={logSpeed === speed ? "active" : ""} key={speed} type="button" onClick={() => setLogSpeed(speed)}>
                    {speed}배
                  </button>
                ))}
              </div>
              <button className="primary-action" type="button" onClick={simulateAgain}>
                <Swords size={18} />
                다시 시뮬
              </button>
            </div>
            <BattleProgress matches={matches} activeIndex={activeMatchIndex} />
            {activeMatch && (
              <MatchCard
                match={activeMatch}
                team={team}
                visibleLogs={activeLogs}
                isLogDone={isLogDone}
                hasNext={activeMatchIndex < matches.length - 1}
                onNext={goNextBattle}
                onSkipResult={() => {
                  if (!activeMatch.skipped) setVisibleLogCount(activeMatch.logs.length);
                }}
              />
            )}
            {runEnded && (
              <section className="reveal-panel" aria-label="능력치 공개">
                <div className="reveal-heading">
                  <p className="eyebrow">능력치 공개</p>
                  <h2>내 선택 결과</h2>
                </div>
                <div className="reveal-grid">
                  {team.map((mon) => <RevealCard key={mon.name} pokemon={mon} />)}
                </div>
              </section>
            )}
          </section>
        )}
      </section>
      <footer className="asset-credit">
        포켓몬 스프라이트 출처: PokeRogue assets. 비상업 친구용 프로토타입.
      </footer>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChoiceCard({
  pokemon: mon,
  onInspect,
}: {
  pokemon: Pokemon;
  onInspect: (pokemon: Pokemon) => void;
}) {
  return (
    <article className="choice" style={{ "--accent": typeColors[mon.types[0]] } as React.CSSProperties}>
      <button className="choice-open" type="button" onClick={() => onInspect(mon)}>
        <PokemonPortrait pokemon={mon} large />
        <h3>{mon.displayName}</h3>
        <div className="meta">{mon.gen}세대 {generationLabels[mon.gen]}</div>
        <div className="type-row">{mon.types.map(typeChip)}</div>
        <div className="hidden-note">능력치는 경기 후 공개</div>
      </button>
      <button className="pick-button" type="button" onClick={() => onInspect(mon)}>
        기술 확인
      </button>
    </article>
  );
}

function ChoiceMoveModal({
  pokemon: mon,
  moves,
  ability,
  onClose,
  onPick,
}: {
  pokemon: Pokemon;
  moves: BattleMove[];
  ability: BattleAbility;
  onClose: () => void;
  onPick: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <article className="move-modal" role="dialog" aria-modal="true" aria-labelledby="choice-move-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div className="move-card-heading">
            <PokemonPortrait pokemon={mon} />
            <div>
              <p className="eyebrow">{mon.gen}세대 {generationLabels[mon.gen]}</p>
              <h3 id="choice-move-title">{mon.displayName}</h3>
              <p>{mon.types.map((type) => typeLabels[type]).join(" / ")}</p>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>
        <AbilityPanel ability={ability} />
        <div className="move-list modal-move-list">
          {moves.map((move) => <MovePill move={move} key={move.name} />)}
        </div>
        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            돌아가기
          </button>
          <button className="pick-button" type="button" onClick={onPick}>
            이 포켓몬 선택
          </button>
        </div>
      </article>
    </div>
  );
}

function TeamSlot({ pokemon: mon }: { pokemon: Pokemon }) {
  return (
    <article className="slot">
        <PokemonPortrait pokemon={mon} />
      <div>
        <h3>{mon.displayName}</h3>
        <div className="meta">{mon.types.map((type) => typeLabels[type]).join(" / ")}</div>
      </div>
    </article>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <article className="slot empty">
      <div className="mark">{index}</div>
      <div>
        <h3>빈 슬롯</h3>
        <div className="meta">후보에서 선택</div>
      </div>
    </article>
  );
}

function PokemonPortrait({ pokemon: mon, large = false }: { pokemon: Pokemon; large?: boolean }) {
  if (mon.spriteUrl) {
    return (
      <div className={large ? "portrait" : "mark sprite-mark"} style={{ background: typeGradient(mon.types) }}>
        <span className="sprite-crop" aria-hidden="true">
          <img src={publicAssetUrl(mon.spriteUrl)} alt="" loading="lazy" />
        </span>
      </div>
    );
  }

  return (
    <div className={large ? "portrait" : "mark"} style={{ background: typeGradient(mon.types) }}>
      {mon.mark}
    </div>
  );
}

function publicAssetUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${width}%` }} />
      </div>
      <span>{value}</span>
    </div>
  );
}

function RevealCard({ pokemon: mon }: { pokemon: Pokemon }) {
  return (
    <article className="reveal-card">
      <PokemonPortrait pokemon={mon} />
      <div>
        <h3>{mon.displayName}</h3>
        <div className="meta">
          {mon.gen}세대 {generationLabels[mon.gen]} · {mon.types.map((type) => typeLabels[type]).join(" / ")}
        </div>
        <div className="reveal-stats">
          <strong>종족값 {mon.total}</strong>
          <span>체력 {mon.hp}</span>
          <span>공격 {mon.attack}</span>
          <span>방어 {mon.defense}</span>
          <span>특공 {mon.specialAttack}</span>
          <span>특방 {mon.specialDefense}</span>
          <span>스피드 {mon.speed}</span>
          <span>시뮬 점수 {Math.round(mon.score)}</span>
        </div>
      </div>
    </article>
  );
}

function LockedParty({
  team,
  teamMoves,
  teamAbilities,
  selectedPokemonName,
  onSelectPokemon,
  onStartBattle,
}: {
  team: Pokemon[];
  teamMoves: Record<string, BattleMove[]>;
  teamAbilities: Record<string, BattleAbility>;
  selectedPokemonName: string | null;
  onSelectPokemon: (name: string) => void;
  onStartBattle: () => void;
}) {
  const selectedPokemon = team.find((mon) => mon.name === selectedPokemonName) ?? team[0];
  const selectedMoves = selectedPokemon ? teamMoves[selectedPokemon.name] ?? [] : [];
  const selectedAbility = selectedPokemon ? teamAbilities[selectedPokemon.name] : undefined;

  return (
    <article className="locked-party">
      <div className="locked-heading">
        <div>
          <p className="eyebrow">전투 준비</p>
          <h3>기술 확인</h3>
        </div>
        <button className="pick-button start-battle-button" type="button" onClick={onStartBattle}>
          <Swords size={18} />
          전투 시작
        </button>
      </div>
      <div className="move-preview">
        <div className="move-party-list" aria-label="기술 확인할 포켓몬">
          {team.map((mon) => (
            <button
              className={selectedPokemon?.name === mon.name ? "move-party-button active" : "move-party-button"}
              key={mon.name}
              type="button"
              onClick={() => onSelectPokemon(mon.name)}
            >
              <PokemonPortrait pokemon={mon} />
              <span>{mon.displayName}</span>
            </button>
          ))}
        </div>
        <div className="move-card">
          {selectedPokemon && (
            <>
              <div className="move-card-heading">
                <PokemonPortrait pokemon={selectedPokemon} />
                <div>
                  <h4>{selectedPokemon.displayName}</h4>
                  <p>{selectedPokemon.types.map((type) => typeLabels[type]).join(" / ")}</p>
                </div>
              </div>
              <div className="move-list">
                {selectedMoves.map((move) => <MovePill move={move} key={move.name} />)}
              </div>
              {selectedAbility && <AbilityPanel ability={selectedAbility} compact />}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function AbilityPanel({ ability, compact = false }: { ability: BattleAbility; compact?: boolean }) {
  const isImplemented = implementedAbilityIds.has(ability.id);
  const isPassive = passiveAbilityIds.has(ability.id);
  return (
    <article className={compact ? "ability-panel compact" : "ability-panel"}>
      <strong>
        특성: {ability.name}
        {ability.isHidden ? <span>숨겨진 특성</span> : null}
        <span className={isImplemented ? "implemented" : isPassive ? "passive" : "pending"}>
          {isImplemented ? "효과 적용" : isPassive ? "전투 영향 없음" : "구현 예정"}
        </span>
      </strong>
      <p>{ability.description}</p>
    </article>
  );
}

function MovePill({ move }: { move: BattleMove }) {
  const statusEffect = inferMoveStatusEffect(move);
  return (
    <article className="move-pill">
      <div>
        <strong>{move.displayName}</strong>
        <span style={{ background: typeColors[move.type] }}>{typeLabels[move.type]}</span>
      </div>
      <p>
        {moveCategoryLabel(move.category)} · 위력 {move.power ?? "-"} · 명중 {move.accuracy ?? "-"} · PP {move.pp ?? "-"}
        {formatMoveStatChanges(move)}
        {statusEffect ? ` · ${statusLabel(statusEffect.condition)} ${Math.round(statusEffect.chance * 100)}%` : ""}
      </p>
    </article>
  );
}

function BattleProgress({ matches, activeIndex }: { matches: MatchResult[]; activeIndex: number }) {
  return (
    <div className="battle-progress" aria-label="전투 진행">
      {matches.map((match, index) => (
        <div className={index === activeIndex ? "active" : index < activeIndex ? "cleared" : ""} key={match.round}>
          <span>{index + 1}</span>
          <strong>{match.round}</strong>
        </div>
      ))}
    </div>
  );
}

function ManualBattleView({
  battle,
  team,
  teamAbilities,
  onChoose,
  onRestart,
}: {
  battle: ManualBattleState;
  team: Pokemon[];
  teamAbilities: Record<string, BattleAbility>;
  onChoose: (choice: string) => void;
  onRestart: () => void;
}) {
  const activePlayer = team.find((mon) => mon.name === battle.playerActive) ?? team[0];
  const activeEnemy = battle.enemy.find((mon) => mon.name === battle.enemyActive) ?? battle.enemy[0];
  const moves = battle.request?.active?.[0]?.moves ?? [];
  const switchTargets = battle.request?.side?.pokemon
    ?.map((requestMon, index) => ({ requestMon, index, pokemon: pokemonFromIdent(team, requestMon.ident) }))
    .filter(({ requestMon, pokemon: mon }) => mon && !requestMon.active && !isFaintedCondition(requestMon.condition)) ?? [];
  const controlsDisabled = Boolean(battle.result || battle.pending || battle.status !== "ready" || battle.request?.wait);
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    const follow = () => {
      node.scrollTop = node.scrollHeight;
    };
    follow();
    const frame = window.requestAnimationFrame(follow);
    const timer = window.setTimeout(follow, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [battle.logs.length]);

  return (
    <section className="tournament manual-battle" aria-label="직접 전투">
      <div className="tournament-heading">
        <div>
          <p className="eyebrow">직접 전투</p>
          <h2>{battle.result ? (battle.result === "win" ? "승리" : "패배") : `${activePlayer.displayName} vs ${activeEnemy.displayName}`}</h2>
          {battle.status === "loading" && <p className="manual-status">Showdown API 연결 중...</p>}
          {battle.status === "error" && <p className="manual-status error">{battle.error}</p>}
        </div>
        <button className="primary-action" type="button" onClick={onRestart}>
          <Swords size={18} />
          다시 전투
        </button>
      </div>
      <div className="manual-stage">
        <ManualSide title="내 파티" pokemon={team} hp={battle.playerHp} activeName={battle.playerActive} abilitySet={teamAbilities} />
        <div className="manual-console">
          <div className="manual-duel">
            <ManualActiveCard pokemon={activePlayer} hp={battle.playerHp[activePlayer.name] ?? 0} ability={teamAbilities[activePlayer.name]} />
            <ManualActiveCard pokemon={activeEnemy} hp={battle.enemyHp[activeEnemy.name] ?? 0} ability={battle.enemyAbilities[activeEnemy.name]} align="right" />
          </div>
          <div className="manual-actions">
            {moves.map((move, index) => {
              const localMove = findLocalMove(activePlayer, move.id, move.move);
              const moveType = localMove?.type ?? activePlayer.types[0];
              return (
              <button
                className="manual-move"
                disabled={controlsDisabled || Boolean(move.disabled)}
                key={`${move.id}-${index}`}
                style={{ "--move": typeColors[moveType] } as React.CSSProperties}
                type="button"
                onClick={() => onChoose(`move ${index + 1}`)}
              >
                <strong>{localMove?.displayName ?? move.move}</strong>
                <span>
                  {typeLabels[moveType]} · PP {move.pp ?? "-"} / {move.maxpp ?? "-"}
                  {move.disabled ? " · 사용 불가" : ""}
                </span>
              </button>
              );
            })}
            {moves.length === 0 && <p className="manual-status">Showdown의 선택 요청을 기다리는 중입니다.</p>}
          </div>
          <div className="manual-switches" aria-label="교체">
            <div className="manual-section-heading">
              <span>교체</span>
              <strong>{battle.result ? "전투 종료" : battle.pending ? "처리 중" : "Showdown 판정"}</strong>
            </div>
            <div className="manual-switch-list">
              {switchTargets.map(({ pokemon: mon, index }) => mon && (
                <button disabled={controlsDisabled} key={mon.name} type="button" onClick={() => onChoose(`switch ${index + 1}`)}>
                  <PokemonPortrait pokemon={mon} />
                  <span>{mon.displayName}</span>
                  <strong>{Math.round(battle.playerHp[mon.name] ?? 0)}%</strong>
                </button>
              ))}
              {switchTargets.length === 0 && <p>교체 가능한 포켓몬이 없습니다.</p>}
            </div>
          </div>
          <div className="battle-log manual-log" ref={logRef}>
            {battle.logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        </div>
        <ManualSide title="상대 파티" pokemon={battle.enemy} hp={battle.enemyHp} activeName={battle.enemyActive} abilitySet={battle.enemyAbilities} align="right" />
      </div>
    </section>
  );
}

function ManualActiveCard({
  pokemon: mon,
  hp,
  ability,
  align = "left",
}: {
  pokemon: Pokemon;
  hp: number;
  ability?: BattleAbility;
  align?: "left" | "right";
}) {
  return (
    <article className={`manual-active ${align === "right" ? "right" : ""}`}>
      <PokemonPortrait pokemon={mon} large />
      <div>
        <h3>{mon.displayName}</h3>
        <p>{mon.types.map((type) => typeLabels[type]).join(" / ")}</p>
        <div className="hp-bar"><span style={{ width: `${clampNumber(hp, 0, 100)}%` }} /></div>
        <strong>HP {Math.max(0, Math.round(hp))}%</strong>
        {ability && <small>{ability.name}</small>}
      </div>
    </article>
  );
}

function ManualSide({
  title,
  pokemon,
  hp,
  activeName,
  abilitySet,
  align = "left",
}: {
  title: string;
  pokemon: Pokemon[];
  hp: Record<string, number>;
  activeName: string;
  abilitySet: Record<string, BattleAbility>;
  align?: "left" | "right";
}) {
  return (
    <div className={`battle-roster manual-side ${align === "right" ? "right" : ""}`}>
      <div className="roster-heading">
        <h4>{title}</h4>
        <span>HP</span>
      </div>
      <div className="roster-list">
        {pokemon.slice(0, 6).map((mon) => {
          const currentHp = hp[mon.name] ?? 0;
          const isDown = currentHp <= 0;
          const isActive = activeName === mon.name && !isDown;
          return (
            <article className={`roster-mon ${isActive ? "active" : ""} ${isDown ? "down" : ""}`} key={mon.name}>
              <PokemonPortrait pokemon={mon} />
              <div>
                <h5>{mon.displayName}</h5>
                <p>{abilitySet[mon.name]?.name ?? mon.types.map((type) => typeLabels[type]).join(" / ")}</p>
              </div>
              <span className="state-badge">{isDown ? "다운" : `${Math.round(currentHp)}%`}</span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  team,
  visibleLogs,
  isLogDone,
  hasNext,
  onNext,
  onSkipResult,
}: {
  match: MatchResult;
  team: Pokemon[];
  visibleLogs: string[];
  isLogDone: boolean;
  hasNext: boolean;
  onNext: () => void;
  onSkipResult: () => void;
}) {
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    const follow = () => {
      node.scrollTop = node.scrollHeight;
    };
    follow();
    const frame = window.requestAnimationFrame(follow);
    const timer = window.setTimeout(follow, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visibleLogs.length]);

  if (match.skipped) {
    return (
      <article className="match">
        <h3>{match.round}</h3>
        <p className="meta">이 경기 전에 이미 탈락했습니다.</p>
      </article>
    );
  }

  const battleState = getBattleState(team, match.enemy, visibleLogs);

  return (
    <article className="match active-match">
      <div className="match-top">
        <div>
          <p className="eyebrow">{match.revealRegion ? `${match.leagueRegion} 리그 공개` : "리그 정보 비공개"}</p>
          <h3>{match.round}</h3>
        </div>
        {isLogDone && <p className={match.win ? "win" : "lose"}>{match.win ? "승리" : "패배"}</p>}
      </div>
      <div className="battle-stage">
        <BattleRoster
          title="내 파티"
          pokemon={team}
          activeName={battleState.playerActive}
          knockedOut={battleState.knockedOut}
        />
        <div className="battle-console" aria-live="polite">
          <div className="console-heading">
            <span>전투 시뮬</span>
            <strong>{battleState.playerActive ?? "대기"} vs {battleState.enemyActive ?? "대기"}</strong>
          </div>
          <div className="battle-log" ref={logRef}>
            {visibleLogs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            {!isLogDone && <p className="typing">...</p>}
          </div>
        </div>
        <BattleRoster
          title="상대 파티"
          pokemon={match.enemy}
          activeName={battleState.enemyActive}
          knockedOut={battleState.knockedOut}
          align="right"
        />
      </div>
      {isLogDone && (
        <div className="match-analysis">
          <p>예상 승률 {(match.winRate * 100).toFixed(1)}% · 판정 굴림 {(match.roll * 100).toFixed(1)}%</p>
          <p>MVP 후보: {match.mvp.displayName} · 주의 대상: {match.risk.displayName}</p>
        </div>
      )}
      {!isLogDone && (
        <button className="next-battle" type="button" onClick={onSkipResult}>
          결과 스킵
        </button>
      )}
      {isLogDone && match.win && hasNext && (
        <button className="next-battle" type="button" onClick={onNext}>
          다음 전투로
        </button>
      )}
    </article>
  );
}

function BattleRoster({
  title,
  pokemon,
  activeName,
  knockedOut,
  align = "left",
}: {
  title: string;
  pokemon: Pokemon[];
  activeName?: string;
  knockedOut: Set<string>;
  align?: "left" | "right";
}) {
  return (
    <div className={`battle-roster ${align === "right" ? "right" : ""}`}>
      <div className="roster-heading">
        <h4>{title}</h4>
        <span>상태</span>
      </div>
      <div className="roster-list">
        {pokemon.slice(0, 6).map((mon, index) => {
          const isDown = knockedOut.has(mon.displayName);
          const isActive = activeName === mon.displayName && !isDown;
          return (
            <article className={`roster-mon ${isActive ? "active" : ""} ${isDown ? "down" : ""}`} key={`${mon.name}-${index}`}>
              <PokemonPortrait pokemon={mon} />
              <div>
                <h5>{mon.displayName}</h5>
                <p>{mon.types.map((type) => typeLabels[type]).join(" / ")}</p>
              </div>
              <span className="state-badge">{isDown ? "다운" : isActive ? "출전" : "대기"}</span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function getBattleState(team: Pokemon[], enemy: Pokemon[], visibleLogs: string[]) {
  const knockedOut = new Set<string>();
  let playerActive: string | undefined = team[0]?.displayName;
  let enemyActive: string | undefined = enemy[0]?.displayName;

  visibleLogs.forEach((line) => {
    [...team, ...enemy].forEach((mon) => {
      if (line.includes(`${mon.displayName} 다운!`)) {
        knockedOut.add(mon.displayName);
      }
    });

    team.forEach((mon) => {
      if (
        line.includes(`내 선봉 ${mon.displayName}`) ||
        line.includes(`내 파티, ${mon.displayName} 등장`) ||
        line.includes(`에서 ${mon.displayName} 교체`)
      ) {
        playerActive = mon.displayName;
      }
    });

    enemy.forEach((mon) => {
      if (
        line.includes(`선봉 ${mon.displayName}`) ||
        line.includes(`${mon.displayName} 등장`) ||
        line.includes(`에서 ${mon.displayName} 교체`)
      ) {
        enemyActive = mon.displayName;
      }
    });
  });

  if (playerActive && knockedOut.has(playerActive)) playerActive = undefined;
  if (enemyActive && knockedOut.has(enemyActive)) enemyActive = undefined;

  return { knockedOut, playerActive, enemyActive };
}

function typeChip(type: Pokemon["types"][number]) {
  return (
    <span className="chip" style={{ background: typeColors[type] }} key={type}>
      {typeLabels[type]}
    </span>
  );
}

function rollRule(): DraftRule {
  const gen = randomItem([...new Set(pokemon.map((mon) => mon.gen))]);
  return { gen };
}

function simulateRun(
  team: Pokemon[],
  mode: GameMode,
  playerMoves: MoveSet,
  playerAbilities: Record<string, BattleAbility>,
): MatchResult[] {
  return mode === "random"
    ? simulateTournament(team, playerMoves, playerAbilities)
    : simulateChampions(team, playerMoves, playerAbilities);
}

function simulateTournament(team: Pokemon[], playerMoves: MoveSet, playerAbilities: Record<string, BattleAbility>): MatchResult[] {
  const matches: MatchResult[] = [];
  let alive = true;

  rounds.forEach((round, index) => {
    if (!alive) {
      matches.push({ round, skipped: true });
      return;
    }

    const enemy = buildEnemyTeam(index).slice(0, 6);
    const projection = calculateWinProjection(team, enemy);
    const roll = Math.random();
    const win = roll <= projection.winRate;
    const battleFeed = createBattleFeed(team, enemy, win, {
      playerMoves,
      playerAbilities,
      enemyMoves: buildMoveSet(enemy),
      enemyAbilities: buildAbilitySet(enemy),
    });
    alive = battleFeed.playerWon;
    matches.push({
      round,
      enemy,
      playerScore: projection.playerScore,
      enemyScore: projection.enemyScore,
      winRate: projection.winRate,
      roll,
      win: battleFeed.playerWon,
      logs: [...battleFeed.logs, ...projection.logs],
      mvp: projection.mvp,
      risk: projection.risk,
    });
  });

  return matches;
}

function simulateChampions(team: Pokemon[], playerMoves: MoveSet, playerAbilities: Record<string, BattleAbility>): MatchResult[] {
  const matches: MatchResult[] = [];
  let alive = true;
  const league = randomItem(championLeagues);

  league.opponents.forEach((opponent, index) => {
    const isFinalBattle = index === league.opponents.length - 1;
    if (!alive) {
      matches.push({ round: `${opponent.title} ${opponent.name}`, skipped: true });
      return;
    }

    const match = simulateOpponent(
      team,
      opponent.team,
      `${opponent.title} ${opponent.name}`,
      opponent,
      {
        leagueRegion: league.region,
        revealRegion: isFinalBattle,
      },
      playerMoves,
      playerAbilities,
    );
    alive = !match.skipped && match.win;
    matches.push(match);
  });

  return matches;
}

function simulateOpponent(
  team: Pokemon[],
  enemy: Pokemon[],
  round: string,
  opponent?: LeagueOpponent,
  options: { leagueRegion?: string; revealRegion?: boolean } = {},
  playerMoves: MoveSet = {},
  playerAbilities: Record<string, BattleAbility> = {},
): MatchResult {
  const enemyTeam = enemy.slice(0, 6);
  const projection = calculateWinProjection(team, enemyTeam);
  const roll = Math.random();
  const win = roll <= projection.winRate;
  const opponentName = opponent?.name ?? "상대";
  const battleFeed = createBattleFeed(team, enemyTeam, win, {
    opponentName,
    playerMoves,
    playerAbilities,
    enemyMoves: buildMoveSet(enemyTeam),
    enemyAbilities: buildAbilitySet(enemyTeam),
  });
  const logs = opponent
    ? [
        options.revealRegion && options.leagueRegion
          ? `${options.leagueRegion} 리그 공개! ${withBattleParticle(`${opponent.title} ${opponent.name}`)}의 승부`
          : `${withBattleParticle(`${opponent.title} ${opponent.name}`)}의 승부`,
        ...battleFeed.logs,
        ...projection.logs,
      ]
    : [...battleFeed.logs, ...projection.logs];

  return {
    round,
    enemy: enemyTeam,
    playerScore: projection.playerScore,
    enemyScore: projection.enemyScore,
    winRate: projection.winRate,
    roll,
    win: battleFeed.playerWon,
    logs,
    mvp: projection.mvp,
    risk: projection.risk,
    leagueRegion: options.leagueRegion,
    revealRegion: options.revealRegion,
  };
}

function createManualBattle(team: Pokemon[]): ManualBattleState {
  const enemy = buildEnemyTeam(0).slice(0, 6);
  const enemyMoves = buildMoveSet(enemy);
  const enemyAbilities = buildAbilitySet(enemy);
  return {
    enemy,
    enemyMoves,
    enemyAbilities,
    playerHp: Object.fromEntries(team.map((mon) => [mon.name, initialManualHp(mon)])),
    enemyHp: Object.fromEntries(enemy.map((mon) => [mon.name, initialManualHp(mon)])),
    playerActive: team[0]?.name ?? "",
    enemyActive: enemy[0]?.name ?? "",
    chunks: [],
    logs: [`Showdown API로 직접 전투를 준비합니다.`],
    status: "loading",
  };
}

function manualBattleFromShowdown(base: ManualBattleState, battleId: string, chunks: string[]): ManualBattleState {
  const playerRequest = latestShowdownRequest(chunks, "p1");
  const enemyRequest = latestShowdownRequest(chunks, "p2");
  const playerHp = requestHpMap(playerRequest);
  const enemyHp = requestHpMap(enemyRequest);
  const playerActive = activeNameFromRequest(playerRequest) ?? base.playerActive;
  const enemyActive = activeNameFromRequest(enemyRequest) ?? base.enemyActive;
  const result = showdownWinner(chunks);

  return {
    ...base,
    battleId,
    chunks,
    playerHp: Object.keys(playerHp).length > 0 ? playerHp : base.playerHp,
    enemyHp: Object.keys(enemyHp).length > 0 ? enemyHp : base.enemyHp,
    playerActive,
    enemyActive,
    request: playerRequest,
    logs: showdownLogs(chunks, [...base.enemy]),
    result,
    pending: false,
    status: "ready",
    error: undefined,
  };
}

async function postShowdown(path: string, body: unknown) {
  const response = await fetch(`${showdownApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{ battleId: string; chunks: string[] }>;
}

function showdownApiBase() {
  const runtimeUrl = new URL(window.location.href);
  const urlParam = runtimeUrl.searchParams.get("api")?.trim();
  if (urlParam) {
    window.localStorage.setItem("pokeproject-showdown-api", urlParam);
    return urlParam.replace(/\/$/, "");
  }

  const storedUrl = window.localStorage.getItem("pokeproject-showdown-api")?.trim();
  if (storedUrl) return storedUrl.replace(/\/$/, "");
  if (buildShowdownApiBase) return buildShowdownApiBase.replace(/\/$/, "");
  return "/api";
}

function latestShowdownRequest(chunks: string[], side: "p1" | "p2"): ShowdownRequest | undefined {
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const lines = chunks[index].split("\n");
    if (lines[0] !== "sideupdate" || lines[1] !== side) continue;
    const requestLine = lines.find((line) => line.startsWith("|request|"));
    if (!requestLine) continue;
    try {
      return JSON.parse(requestLine.slice("|request|".length)) as ShowdownRequest;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function requestHpMap(request: ShowdownRequest | undefined) {
  return Object.fromEntries((request?.side?.pokemon ?? []).map((mon) => [pokemonNameFromIdent(mon.ident), conditionPercent(mon.condition)]));
}

function activeNameFromRequest(request: ShowdownRequest | undefined) {
  const active = request?.side?.pokemon?.find((mon) => mon.active && !isFaintedCondition(mon.condition));
  return active ? pokemonNameFromIdent(active.ident) : undefined;
}

function showdownWinner(chunks: string[]) {
  const joined = chunks.join("\n");
  if (joined.includes("|win|Player")) return "win" as const;
  if (joined.includes("|win|Enemy")) return "lose" as const;
  return undefined;
}

function showdownLogs(chunks: string[], enemy: Pokemon[]) {
  const logs = chunks.flatMap((chunk) =>
    chunk
      .split("\n")
      .map((line) => formatShowdownLog(line, enemy))
      .filter((line): line is string => Boolean(line)),
  );
  return logs.length > 0 ? uniqueConsecutiveLogs(logs) : ["Showdown 전투 로그를 기다리는 중입니다."];
}

function formatShowdownLog(line: string, enemy: Pokemon[]) {
  const parts = line.split("|");
  const tag = parts[1];
  if (tag === "start") return "전투 시작!";
  if (tag === "turn") return `${parts[2]}턴`;
  if (tag === "switch") return `${sideLabel(parts[2], enemy)}, ${displayFromIdent(parts[2], enemy)} 등장.`;
  if (tag === "move") return `${displayFromIdent(parts[2], enemy)}의 ${parts[3]}!`;
  if (tag === "-damage") return `${displayFromIdent(parts[2], enemy)} HP ${parts[3]}.`;
  if (tag === "-heal") return `${displayFromIdent(parts[2], enemy)} 회복. HP ${parts[3]}.`;
  if (tag === "faint") return `${displayFromIdent(parts[2], enemy)} 다운!`;
  if (tag === "-miss") return `${displayFromIdent(parts[2], enemy)}의 공격은 빗나갔다.`;
  if (tag === "-immune") return `${displayFromIdent(parts[2], enemy)}에게 효과가 없다.`;
  if (tag === "-supereffective") return "효과가 굉장했다!";
  if (tag === "-resisted") return "효과가 별로였다.";
  if (tag === "-crit") return "급소에 맞았다!";
  if (tag === "-mustrecharge") return `${displayFromIdent(parts[2], enemy)} 재충전이 필요하다.`;
  if (tag === "cant") return `${displayFromIdent(parts[2], enemy)} 행동할 수 없다.`;
  if (tag === "win") return parts[2] === "Player" ? "승리!" : "패배...";
  return undefined;
}

function uniqueConsecutiveLogs(logs: string[]) {
  return logs.filter((line, index) => index === 0 || logs[index - 1] !== line);
}

function pokemonNameFromIdent(ident: string) {
  return ident.includes(": ") ? ident.split(": ").slice(1).join(": ") : ident;
}

function displayFromIdent(ident: string, enemy: Pokemon[]) {
  const name = pokemonNameFromIdent(ident);
  return pokemon.find((mon) => mon.name === name)?.displayName ?? enemy.find((mon) => mon.name === name)?.displayName ?? name;
}

function sideLabel(ident: string, enemy: Pokemon[]) {
  return enemy.some((mon) => mon.name === pokemonNameFromIdent(ident)) || ident.startsWith("p2") ? "상대" : "내 파티";
}

function conditionPercent(condition: string) {
  if (isFaintedCondition(condition)) return 0;
  const match = condition.match(/^(\d+)\/(\d+)/);
  if (!match) return 100;
  const current = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  return max > 0 ? Math.round((current / max) * 100) : 0;
}

function isFaintedCondition(condition: string) {
  return condition.includes("fnt") || condition.startsWith("0 ");
}

function pokemonFromIdent(team: Pokemon[], ident: string) {
  const name = pokemonNameFromIdent(ident);
  return team.find((mon) => mon.name === name);
}

function normalizeMoveId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findLocalMove(mon: Pokemon, id: string, name: string) {
  const target = normalizeMoveId(id || name);
  return mon.movePool.find((move) => normalizeMoveId(move.name) === target || normalizeMoveId(move.displayName) === target);
}

function randomShowdownSeed() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x10000));
}

function initialManualHp(mon: Pokemon) {
  return mon.hp <= 1 ? 1 : 100;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function rollMoves(mon: Pokemon) {
  const damagingMoves = shuffle(mon.movePool.filter((move) => move.category !== "status" && move.power !== null));
  const statusMoves = shuffle(mon.movePool.filter((move) => move.category === "status" || move.power === null));
  const sameTypeMoves = damagingMoves.filter((move) => mon.types.includes(move.type));
  const selected = uniqueMoves([
    ...sameTypeMoves.slice(0, 2),
    ...damagingMoves.slice(0, 4),
    ...statusMoves.slice(0, 2),
    ...shuffle(mon.movePool),
  ]);

  return selected.slice(0, 4);
}

function rollAbility(mon: Pokemon) {
  const actualAbilities = mon.abilities?.filter((ability) => ability.id && ability.name) ?? [];
  if (actualAbilities.length > 0) return randomItem(actualAbilities);
  return { id: "unknown", name: "특성 없음", description: "PokeAPI 특성 데이터가 없습니다." };
}

function buildAbilitySet(team: Pokemon[]) {
  return Object.fromEntries(team.map((mon) => [mon.name, rollAbility(mon)]));
}

function buildMoveSet(team: Pokemon[]): MoveSet {
  return Object.fromEntries(team.map((mon) => [mon.name, rollMoves(mon)]));
}

function uniqueMoves(moves: BattleMove[]) {
  const seen = new Set<string>();
  return moves.filter((move) => {
    if (seen.has(move.name)) return false;
    seen.add(move.name);
    return true;
  });
}

function moveCategoryLabel(category: BattleMove["category"]) {
  if (category === "physical") return "물리";
  if (category === "special") return "특수";
  return "변화";
}

function formatMoveStatChanges(move: BattleMove) {
  const changes = (move.statChanges ?? [])
    .filter((change) => change.change !== 0)
    .map((change) => `${moveStatLabel(change.stat)} ${change.change > 0 ? "+" : ""}${change.change}`);

  return changes.length > 0 ? ` · 랭크 ${changes.join(", ")}` : "";
}

function inferMoveStatusEffect(move: BattleMove): { condition: StatusCondition; chance: number } | undefined {
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

function statusLabel(condition: StatusCondition) {
  if (condition === "burn") return "화상";
  if (condition === "poison") return "독";
  if (condition === "paralysis") return "마비";
  if (condition === "sleep") return "잠듦";
  if (condition === "freeze") return "얼음";
  return "혼란";
}

function moveStatLabel(stat: string) {
  if (stat === "attack") return "공격";
  if (stat === "defense") return "방어";
  if (stat === "special-attack") return "특공";
  if (stat === "special-defense") return "특방";
  if (stat === "speed") return "스피드";
  if (stat === "accuracy") return "명중";
  if (stat === "evasion") return "회피";
  return stat;
}

function withBattleParticle(label: string) {
  const last = label[label.length - 1];
  const code = last.charCodeAt(0);
  const hasFinalConsonant = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${label}${hasFinalConsonant ? "과" : "와"}`;
}

function subjectParticle(label: string) {
  const last = label[label.length - 1];
  const code = last.charCodeAt(0);
  const hasFinalConsonant = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return hasFinalConsonant ? "은" : "는";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
