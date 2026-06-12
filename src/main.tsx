import React from "react";
import ReactDOM from "react-dom/client";
import { RotateCcw, Swords } from "lucide-react";
import "./styles.css";
import { calculateWinProjection, createBattleFeed } from "./battle";
import { indigoLeague, type LeagueOpponent } from "./leagues";
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
  type MatchResult,
  type Pokemon,
} from "./model";

const rounds = ["16강", "8강", "4강", "결승"] as const;
type GameMode = "random" | "champions";

function App() {
  const [mode, setMode] = React.useState<GameMode>("random");
  const [team, setTeam] = React.useState<Pokemon[]>([]);
  const [rule, setRule] = React.useState<DraftRule>(() => rollRule());
  const [choices, setChoices] = React.useState<Pokemon[]>(() => buildChoices(rule, []));
  const [matches, setMatches] = React.useState<MatchResult[]>([]);

  const pickNumber = team.length + 1;
  const exactMatches = choices.filter((mon) => mon.gen === rule.gen && mon.types.includes(rule.type)).length;
  const ruleSuffix = exactMatches < choices.length ? " + 와일드카드" : "";
  const isDrafting = team.length < 6;
  const isRevealed = matches.length > 0;
  const champion = matches.length > 0 && matches.every((match) => match.skipped || match.win);
  const modeLabel = mode === "random" ? "랜덤 토너먼트" : "포챔스";

  function startRun() {
    const nextRule = rollRule();
    setTeam([]);
    setMatches([]);
    setRule(nextRule);
    setChoices(buildChoices(nextRule, []));
  }

  function pickPokemon(mon: Pokemon) {
    const nextTeam = [...team, mon];
    setTeam(nextTeam);

    if (nextTeam.length >= 6) {
      setMatches(simulateRun(nextTeam, mode));
      return;
    }

    const nextRule = rollRule();
    setRule(nextRule);
    setChoices(buildChoices(nextRule, nextTeam));
  }

  function simulateAgain() {
    setMatches(simulateRun(team, mode));
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    const nextRule = rollRule();
    setTeam([]);
    setMatches([]);
    setRule(nextRule);
    setChoices(buildChoices(nextRule, []));
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
          <Status label="조건" value={`${rule.gen}세대 ${generationLabels[rule.gen]} · ${typeLabels[rule.type]}${ruleSuffix}`} />
          <button className="primary-action" type="button" onClick={startRun}>
            <RotateCcw size={18} />
            새로 시작
          </button>
        </div>
      </section>

      <section className="board">
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

        <section className="draft-panel">
          <div className="draft-heading">
            <div>
              <p className="eyebrow">랜덤 조건</p>
              <h2>{isDrafting ? `${pickNumber}번째 파티원을 고르세요` : "파티 선택 완료"}</h2>
            </div>
            <div className="rule-card">
              <span>{rule.gen}세대 {generationLabels[rule.gen]}</span>
              <strong>{typeLabels[rule.type]} 타입</strong>
            </div>
          </div>
          <div className="choices" aria-live="polite">
            {isDrafting
              ? choices.map((mon) => <ChoiceCard key={mon.name} pokemon={mon} onPick={pickPokemon} />)
              : <LockedParty onSimulate={simulateAgain} />}
          </div>
        </section>
      </section>

      {matches.length > 0 && (
        <section className="tournament" aria-label="토너먼트 결과">
          <div className="tournament-heading">
            <div>
              <p className="eyebrow">{mode === "random" ? "챔피언 도전" : "포챔스 도전"}</p>
              <h2>{champion ? (mode === "random" ? "우승 성공" : "포챔스 제패") : "탈락"}</h2>
            </div>
            <button className="primary-action" type="button" onClick={simulateAgain}>
              <Swords size={18} />
              다시 시뮬
            </button>
          </div>
          <div className="bracket">
            {matches.map((match) => <MatchCard key={match.round} match={match} />)}
          </div>
          <section className="reveal-panel" aria-label="능력치 공개">
            <div className="reveal-heading">
              <p className="eyebrow">능력치 공개</p>
              <h2>내 선택 결과</h2>
            </div>
            <div className="reveal-grid">
              {team.map((mon) => <RevealCard key={mon.name} pokemon={mon} />)}
            </div>
          </section>
        </section>
      )}
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

function ChoiceCard({ pokemon: mon, onPick }: { pokemon: Pokemon; onPick: (pokemon: Pokemon) => void }) {
  return (
    <article className="choice" style={{ "--accent": typeColors[mon.types[0]] } as React.CSSProperties}>
      <div>
        <PokemonPortrait pokemon={mon} large />
        <h3>{mon.displayName}</h3>
        <div className="meta">{mon.gen}세대 {generationLabels[mon.gen]}</div>
        <div className="type-row">{mon.types.map(typeChip)}</div>
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
          <span>시뮬 점수 {Math.round(mon.score)}</span>
        </div>
      </div>
    </article>
  );
}

function LockedParty({ onSimulate }: { onSimulate: () => void }) {
  return (
    <article className="locked-party">
      <Swords size={48} />
      <h3>드래프트 완료</h3>
      <p>같은 여섯 마리로 다시 시뮬레이션하거나 새 런을 시작할 수 있습니다.</p>
      <button className="pick-button" type="button" onClick={onSimulate}>
        시뮬레이션
      </button>
    </article>
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  if (match.skipped) {
    return (
      <article className="match">
        <h3>{match.round}</h3>
        <p className="meta">이 경기 전에 이미 탈락했습니다.</p>
      </article>
    );
  }

  return (
    <article className="match">
      <h3>{match.round}</h3>
      <p className={match.win ? "win" : "lose"}>{match.win ? "승리" : "패배"}</p>
      <p className="meta">내 파티 {Math.round(match.playerScore)}점</p>
      <p className="meta">상대 {Math.round(match.enemyScore)}점</p>
      <p className="meta">예상 승률 {(match.winRate * 100).toFixed(1)}% · 판정 굴림 {(match.roll * 100).toFixed(1)}%</p>
      <p className="meta">{match.enemy.map((mon) => mon.displayName).join(", ")}</p>
      <div className="battle-log">
        {match.logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        <p>MVP 후보: {match.mvp.displayName}</p>
        <p>주의 대상: {match.risk.displayName}</p>
      </div>
    </article>
  );
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
  const type = randomItem([...new Set(pokemon.flatMap((mon) => mon.types))]);
  return { gen, type };
}

function simulateRun(team: Pokemon[], mode: GameMode): MatchResult[] {
  return mode === "random" ? simulateTournament(team) : simulateChampions(team);
}

function simulateTournament(team: Pokemon[]): MatchResult[] {
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
    const battleLogs = createBattleFeed(team, enemy, win);
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

function simulateChampions(team: Pokemon[]): MatchResult[] {
  const matches: MatchResult[] = [];
  let alive = true;

  indigoLeague.forEach((opponent) => {
    if (!alive) {
      matches.push({ round: `${opponent.title} ${opponent.name}`, skipped: true });
      return;
    }

    const match = simulateOpponent(team, opponent.team, `${opponent.title} ${opponent.name}`, opponent);
    alive = !match.skipped && match.win;
    matches.push(match);
  });

  return matches;
}

function simulateOpponent(team: Pokemon[], enemy: Pokemon[], round: string, opponent?: LeagueOpponent): MatchResult {
  const projection = calculateWinProjection(team, enemy);
  const roll = Math.random();
  const win = roll <= projection.winRate;
  const opponentName = opponent?.name ?? "상대";
  const battleLogs = createBattleFeed(team, enemy, win, { opponentName });
  const logs = opponent
    ? [`${opponent.title} ${opponent.name}와의 승부`, ...battleLogs, ...projection.logs]
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
  };
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
