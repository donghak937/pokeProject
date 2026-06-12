import React from "react";
import ReactDOM from "react-dom/client";
import { RotateCcw, Swords } from "lucide-react";
import "./styles.css";
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

function App() {
  const [team, setTeam] = React.useState<Pokemon[]>([]);
  const [rule, setRule] = React.useState<DraftRule>(() => rollRule());
  const [choices, setChoices] = React.useState<Pokemon[]>(() => buildChoices(rule, []));
  const [matches, setMatches] = React.useState<MatchResult[]>([]);

  const pickNumber = team.length + 1;
  const exactMatches = choices.filter((mon) => mon.gen === rule.gen && mon.types.includes(rule.type)).length;
  const ruleSuffix = exactMatches < choices.length ? " + 와일드카드" : "";
  const isDrafting = team.length < 6;
  const champion = matches.length > 0 && matches.every((match) => match.skipped || match.win);

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
      setMatches(simulateTournament(nextTeam));
      return;
    }

    const nextRule = rollRule();
    setRule(nextRule);
    setChoices(buildChoices(nextRule, nextTeam));
  }

  function simulateAgain() {
    setMatches(simulateTournament(team));
  }

  return (
    <main className="app">
      <section className="topbar" aria-label="게임 상태">
        <div>
          <p className="eyebrow">팬 드래프트 배틀</p>
          <h1>타입 드래프트 아레나</h1>
        </div>
        <div className="status-strip">
          <Status label="선택" value={isDrafting ? `${pickNumber} / 6` : "완성"} />
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
            <span>{Math.round(teamPower(team))}점</span>
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
              <p className="eyebrow">챔피언 도전</p>
              <h2>{champion ? "우승 성공" : "탈락"}</h2>
            </div>
            <button className="primary-action" type="button" onClick={simulateAgain}>
              <Swords size={18} />
              다시 시뮬
            </button>
          </div>
          <div className="bracket">
            {matches.map((match) => <MatchCard key={match.round} match={match} />)}
          </div>
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
        <div className="meta">{mon.gen}세대 {generationLabels[mon.gen]} · 종족값 {mon.total}</div>
        <div className="type-row">{mon.types.map(typeChip)}</div>
        <div className="score-line">드래프트 점수 {Math.round(mon.score)}</div>
        <div className="stats">
          <StatBar label="체력" value={mon.hp} max={160} />
          <StatBar label="공격" value={mon.attack} max={150} />
          <StatBar label="방어" value={mon.defense} max={140} />
        </div>
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
        <div className="meta">{mon.types.map((type) => typeLabels[type]).join(" / ")} · {Math.round(mon.score)}점</div>
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
      <p className="meta">{match.enemy.map((mon) => mon.displayName).join(", ")}</p>
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

function simulateTournament(team: Pokemon[]): MatchResult[] {
  const matches: MatchResult[] = [];
  let alive = true;

  rounds.forEach((round, index) => {
    if (!alive) {
      matches.push({ round, skipped: true });
      return;
    }

    const enemy = buildEnemyTeam(index);
    const playerScore = battleScore(team, enemy);
    const enemyScore = battleScore(enemy, team);
    const win = playerScore >= enemyScore;
    alive = win;
    matches.push({ round, enemy, playerScore, enemyScore, win });
  });

  return matches;
}

function battleScore(team: Pokemon[], opponent: Pokemon[]) {
  const base = teamPower(team);
  const matchup = teamMatchup(team, opponent);
  const variance = randomBetween(-72, 72);
  return base + matchup + variance;
}

function teamMatchup(team: Pokemon[], opponent: Pokemon[]) {
  return team.reduce((sum, attacker) => {
    const best = Math.max(...opponent.map((defender) => matchupValue(attacker, defender)));
    return sum + best * 34;
  }, 0);
}

function matchupValue(attacker: Pokemon, defender: Pokemon) {
  const values = attacker.types.flatMap((attackType) =>
    defender.types.map((defenseType) => typeChart[attackType]?.[defenseType] ?? 1),
  );
  return Math.max(...values);
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const typeChart: Record<string, Partial<Record<string, number>>> = {
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
