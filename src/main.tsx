import React from "react";
import ReactDOM from "react-dom/client";
import { RotateCcw, Swords } from "lucide-react";
import "./styles.css";
import { calculateWinProjection, createBattleFeed, type MoveSet } from "./battle";
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
  type BattleMove,
  type MatchResult,
  type Pokemon,
} from "./model";

const rounds = ["16강", "8강", "4강", "결승"] as const;
type GameMode = "random" | "champions";
const logSpeeds = [0.5, 0.75, 1, 1.5, 2] as const;
type LogSpeed = (typeof logSpeeds)[number];

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
  const [selectedMovePokemon, setSelectedMovePokemon] = React.useState<string | null>(null);
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
  const modeLabel = mode === "random" ? "랜덤 토너먼트" : "포챔스";
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
  }, [choices]);

  React.useEffect(() => {
    if (!activeMatch || activeMatch.skipped || visibleLogCount >= activeMatch.logs.length) return;

    const timer = window.setTimeout(() => {
      setVisibleLogCount((count) => Math.min(count + 1, activeMatch.logs.length));
    }, 680 / logSpeed);

    return () => window.clearTimeout(timer);
  }, [activeMatch, visibleLogCount, logSpeed]);

  function startRun() {
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, []);
    setTeam([]);
    setMatches([]);
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
    setTeamMoves({});
    setChoiceMoves(buildMoveSet(nextChoices));
    setSelectedMovePokemon(null);
    setSameGenRerolls(2);
    setWildRerolls(2);
    setRule(nextRule);
    setChoices(nextChoices);
  }

  function pickPokemon(mon: Pokemon) {
    const nextTeam = [...team, mon];
    setTeam(nextTeam);
    setTeamMoves((current) => ({
      ...current,
      [mon.name]: current[mon.name] ?? choiceMoves[mon.name] ?? rollMoves(mon),
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
    setSameGenRerolls(2);
    setWildRerolls(2);
  }

  function simulateAgain() {
    setMatches(simulateRun(team, mode, teamMoves));
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
  }

  function startBattle() {
    setMatches(simulateRun(team, mode, teamMoves));
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, []);
    setTeam([]);
    setMatches([]);
    setActiveMatchIndex(0);
    setVisibleLogCount(1);
    setTeamMoves({});
    setChoiceMoves(buildMoveSet(nextChoices));
    setSelectedMovePokemon(null);
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
    setChoices(nextChoices);
    setChoiceMoves(buildMoveSet(nextChoices));
    setSameGenRerolls((count) => count - 1);
  }

  function rerollAnyGeneration() {
    if (wildRerolls <= 0 || !isDrafting) return;
    const nextRule = rollRule();
    const nextChoices = buildChoices(nextRule, team);
    setRule(nextRule);
    setChoices(nextChoices);
    setChoiceMoves(buildMoveSet(nextChoices));
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

      <section className={matches.length > 0 ? "board battle-board" : "board"}>
        {matches.length === 0 && (
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

        {matches.length === 0 ? (
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
                ? choices.map((mon) => <ChoiceCard key={mon.name} pokemon={mon} moves={choiceMoves[mon.name] ?? []} onPick={pickPokemon} />)
                : (
                    <LockedParty
                      team={team}
                      teamMoves={teamMoves}
                      selectedPokemonName={selectedMovePokemon ?? team[0]?.name ?? null}
                      onSelectPokemon={setSelectedMovePokemon}
                      onStartBattle={startBattle}
                    />
                  )}
            </div>
          </section>
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
  moves,
  onPick,
}: {
  pokemon: Pokemon;
  moves: BattleMove[];
  onPick: (pokemon: Pokemon) => void;
}) {
  return (
    <article className="choice" style={{ "--accent": typeColors[mon.types[0]] } as React.CSSProperties}>
      <div>
        <PokemonPortrait pokemon={mon} large />
        <h3>{mon.displayName}</h3>
        <div className="meta">{mon.gen}세대 {generationLabels[mon.gen]}</div>
        <div className="type-row">{mon.types.map(typeChip)}</div>
        <div className="choice-moves">
          {moves.map((move) => (
            <div className="choice-move" key={move.name}>
              <span style={{ background: typeColors[move.type] }}>{typeLabels[move.type]}</span>
              <strong>{move.displayName}</strong>
              <em>{moveCategoryLabel(move.category)} {move.power ? `· ${move.power}` : ""}</em>
            </div>
          ))}
        </div>
        <div className="hidden-note">능력치는 경기 후 공개</div>
      </div>
      <button className="pick-button" type="button" onClick={() => onPick(mon)}>
        선택
      </button>
    </article>
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
          <img src={mon.spriteUrl} alt="" loading="lazy" />
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
  selectedPokemonName,
  onSelectPokemon,
  onStartBattle,
}: {
  team: Pokemon[];
  teamMoves: Record<string, BattleMove[]>;
  selectedPokemonName: string | null;
  onSelectPokemon: (name: string) => void;
  onStartBattle: () => void;
}) {
  const selectedPokemon = team.find((mon) => mon.name === selectedPokemonName) ?? team[0];
  const selectedMoves = selectedPokemon ? teamMoves[selectedPokemon.name] ?? [] : [];

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
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function MovePill({ move }: { move: BattleMove }) {
  return (
    <article className="move-pill">
      <div>
        <strong>{move.displayName}</strong>
        <span style={{ background: typeColors[move.type] }}>{typeLabels[move.type]}</span>
      </div>
      <p>
        {moveCategoryLabel(move.category)} · 위력 {move.power ?? "-"} · 명중 {move.accuracy ?? "-"} · PP {move.pp ?? "-"}
        {formatMoveStatChanges(move)}
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

function MatchCard({
  match,
  team,
  visibleLogs,
  isLogDone,
  hasNext,
  onNext,
}: {
  match: MatchResult;
  team: Pokemon[];
  visibleLogs: string[];
  isLogDone: boolean;
  hasNext: boolean;
  onNext: () => void;
}) {
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
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
        {pokemon.map((mon) => {
          const isDown = knockedOut.has(mon.displayName);
          const isActive = activeName === mon.displayName && !isDown;
          return (
            <article className={`roster-mon ${isActive ? "active" : ""} ${isDown ? "down" : ""}`} key={mon.name}>
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

function simulateRun(team: Pokemon[], mode: GameMode, playerMoves: MoveSet): MatchResult[] {
  return mode === "random" ? simulateTournament(team, playerMoves) : simulateChampions(team, playerMoves);
}

function simulateTournament(team: Pokemon[], playerMoves: MoveSet): MatchResult[] {
  const matches: MatchResult[] = [];
  let alive = true;

  rounds.forEach((round, index) => {
    if (!alive) {
      matches.push({ round, skipped: true });
      return;
    }

    const enemy = buildEnemyTeam(index);
    const projection = calculateWinProjection(team, enemy);
    const roll = Math.random();
    const win = roll <= projection.winRate;
    const battleLogs = createBattleFeed(team, enemy, win, {
      playerMoves,
      enemyMoves: buildMoveSet(enemy),
    });
    alive = win;
    matches.push({
      round,
      enemy,
      playerScore: projection.playerScore,
      enemyScore: projection.enemyScore,
      winRate: projection.winRate,
      roll,
      win,
      logs: [...battleLogs, ...projection.logs],
      mvp: projection.mvp,
      risk: projection.risk,
    });
  });

  return matches;
}

function simulateChampions(team: Pokemon[], playerMoves: MoveSet): MatchResult[] {
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
): MatchResult {
  const projection = calculateWinProjection(team, enemy);
  const roll = Math.random();
  const win = roll <= projection.winRate;
  const opponentName = opponent?.name ?? "상대";
  const battleLogs = createBattleFeed(team, enemy, win, {
    opponentName,
    playerMoves,
    enemyMoves: buildMoveSet(enemy),
  });
  const logs = opponent
    ? [
        options.revealRegion && options.leagueRegion
          ? `${options.leagueRegion} 리그 공개! ${withBattleParticle(`${opponent.title} ${opponent.name}`)}의 승부`
          : `${withBattleParticle(`${opponent.title} ${opponent.name}`)}의 승부`,
        ...battleLogs,
        ...projection.logs,
      ]
    : [...battleLogs, ...projection.logs];

  return {
    round,
    enemy,
    playerScore: projection.playerScore,
    enemyScore: projection.enemyScore,
    winRate: projection.winRate,
    roll,
    win,
    logs,
    mvp: projection.mvp,
    risk: projection.risk,
    leagueRegion: options.leagueRegion,
    revealRegion: options.revealRegion,
  };
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
