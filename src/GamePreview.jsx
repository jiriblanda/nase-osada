import { useMemo, useState } from "react";
import "./game-preview.css";

const PLAYER_COLORS = ["#c75d50", "#5b91d0", "#69a96e", "#d7b34e", "#a47acb", "#df914e"];
const TILES = [
  { q: 0, r: 0, type: "start", name: "Startovní louka", icon: "⛺", road: true },
  { q: 1, r: 0, type: "forest", name: "Les", icon: "🌲", road: true },
  { q: -1, r: 0, type: "meadow", name: "Louka", icon: "🌿", road: true },
  { q: 0, r: 1, type: "rock", name: "Skály", icon: "⛰️", road: true },
  { q: 0, r: -1, type: "water", name: "Rybník", icon: "💧", road: true },
  { q: 1, r: -1, type: "meadow", name: "Louka", icon: "🌼", road: true },
  { q: -1, r: 1, type: "forest", name: "Les", icon: "🌳", road: true },
  { q: 2, r: 0, type: "gold", name: "Zlatonosné hory", icon: "✨", road: true },
  { q: 2, r: -1, type: "meadow", name: "Louka", icon: "🌿", road: true },
  { q: 1, r: 1, type: "rock", name: "Skály", icon: "🪨", road: true },
  { q: 0, r: 2, type: "meadow", name: "Louka", icon: "🌼", road: true },
  { q: -1, r: 2, type: "forest", name: "Les", icon: "🌲", road: true },
  { q: -2, r: 2, type: "meadow", name: "Louka", icon: "🌿", road: true },
  { q: -2, r: 1, type: "rock", name: "Skály", icon: "⛰️", road: true },
  { q: -2, r: 0, type: "water", name: "Rybník", icon: "💧", road: true },
  { q: -1, r: -1, type: "meadow", name: "Louka", icon: "🌼", road: true },
  { q: 0, r: -2, type: "forest", name: "Les", icon: "🌳", road: true },
  { q: 1, r: -2, type: "meadow", name: "Louka", icon: "🌿", road: true },
  { q: 2, r: -2, type: "rock", name: "Skály", icon: "🪨", road: true }
];
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export default function GamePreview({ onBack, mode = "multi" }) {
  const isSolo = mode === "solo";
  const actionsPerRound = isSolo ? 4 : 2;
  const [revealed, setRevealed] = useState(["0,0"]);
  const [position, setPosition] = useState("0,0");
  const [actions, setActions] = useState(actionsPerRound);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState("Vydej se na sousední políčko a odhal, co se skrývá v krajině.");
  const [resources] = useState({ wood: 2, stone: 2, food: 2, water: 1, gold: 0 });
  const [boardSide, setBoardSide] = useState("front");

  const tileByKey = useMemo(() => new Map(TILES.map(tile => [`${tile.q},${tile.r}`, tile])), []);
  const currentTile = tileByKey.get(position);

  function isAdjacent(tile) {
    const [q, r] = position.split(",").map(Number);
    return DIRECTIONS.some(([dq, dr]) => q + dq === tile.q && r + dr === tile.r);
  }

  function explore(tile) {
    if (actions < 1) return;
    const key = `${tile.q},${tile.r}`;
    if (!isAdjacent(tile) || revealed.includes(key)) return;
    setRevealed(previous => [...previous, key]);
    setPosition(key);
    setActions(value => value - 1);
    setMessage(`Objevil jsi: ${tile.name}. Políčko je nyní součástí mapy.`);
  }

  function nextRound() {
    setRound(value => value + 1);
    setActions(actionsPerRound);
    setMessage(`Začíná nové kolo. Obnovily se ${actionsPerRound} akce.`);
  }

  const resourceItems = [
    ["🪵", "Dřevo", resources.wood], ["🪨", "Kámen", resources.stone],
    ["🍎", "Jídlo", resources.food], ["💧", "Voda", resources.water],
    ["🪙", "Zlato", resources.gold]
  ];

  return (
    <main className="game-preview">
      <header className="preview-header">
        <button className="preview-back" onClick={onBack}>← Zpět do čekárny</button>
        <div className="preview-brand"><span>⌂</span><div><small>{isSolo ? "SÓLO TESTOVACÍ REŽIM" : "MULTIPLAYER TESTOVACÍ REŽIM"}</small><h1>Naše osada</h1></div></div>
        <div className="round-pill">Kolo {round}</div>
      </header>

      <section className="preview-intro">
        <div><p className="preview-kicker">{isSolo ? "SÓLO HRA · 1 HRÁČ" : "HERNÍ NÁHLED · 2–6 HRÁČŮ"}</p><h2>Začíná dobrodružství</h2><p>Prozkoumej okolí společného stanu a připrav místo pro svou osadu.</p></div>
        <div className="action-counter"><strong>{actions}</strong><span>akce zbývají</span><small>{actionsPerRound} za kolo</small></div>
      </section>

      <div className="preview-layout">
        <section className="map-panel">
          <div className="panel-topline"><div><small>MAPA OSADY</small><h3>Prozkoumaná krajina</h3></div><span className="map-key">⬡ Hexová mapa</span></div>
          <div className="hex-map">
            {TILES.map(tile => {
              const key = `${tile.q},${tile.r}`;
              const known = revealed.includes(key);
              const here = position === key;
              const left = 50 + (tile.q + tile.r / 2) * 15.5;
              const top = 50 + tile.r * 17.8;
              return <button
                key={key}
                className={`hex-tile ${known ? `terrain-${tile.type}` : "terrain-hidden"} ${here ? "is-current" : ""} ${!known && isAdjacent(tile) ? "is-next" : ""}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => known ? setMessage(tile.name + (here ? " – právě zde stojíš." : ".")) : explore(tile)}
                title={known ? tile.name : "Neprozkoumané políčko"}
              >
                <span>{known ? tile.icon : "?"}</span>
                {here && <i className="player-figure" />}
                {known && <small>{tile.type === "start" ? "STAN" : tile.name}</small>}
              </button>;
            })}
          </div>
          <div className="map-legend"><span><i className="legend-current" /> Tvoje poloha</span><span><i className="legend-hidden" /> Neprozkoumáno</span><span><i className="legend-next" /> Dostupný průzkum</span></div>
          <div className="game-message"><span>✦</span>{message}</div>
          <div className="map-actions"><button onClick={nextRound} disabled={actions > 0}>Ukončit kolo a pokračovat</button><small>Každý průzkum sousedního hexu stojí 1 akci.</small></div>
        </section>

        <aside className="side-panels">
          <section className="mini-panel">
            <div className="mini-heading"><span>📦</span><div><small>SPOLEČNÉ ZÁSOBY</small><h3>Sklad osady</h3></div></div>
            <div className="resource-grid">{resourceItems.map(([icon, name, amount]) => <div className="resource" key={name}><span>{icon}</span><small>{name}</small><strong>{amount}</strong></div>)}</div>
            <p className="capacity-note">Ukázkové počáteční zásoby. Voda má vlastní úložiště ve studni.</p>
          </section>

          <section className="mini-panel player-board">
            <div className="board-title-row">
              <div className="mini-heading"><span>🧑‍🌾</span><div><small>OSOBNÍ DESKA HRÁČE</small><h3>Tvůj osadník</h3></div></div>
              <button className="flip-board" onClick={() => setBoardSide(side => side === "front" ? "back" : "front")}>↻ {boardSide === "front" ? "Zadní strana" : "Přední strana"}</button>
            </div>
            {boardSide === "front" ? (
              <>
                <div className="player-status"><span className="player-dot" /> Hráč 1 <span className="player-color">●</span></div>
                <div className="board-section"><b>🎒 Inventář – batoh</b><p className="empty-inventory">Zatím prázdný. Nalezené předměty se budou zobrazovat zde.</p></div>
                <div className="board-section"><b>⚔️ Osobní výbava</b><div className="equipment-slots"><span>🗡️ Zbraň</span><span>🛡️ Štít</span><span>🥋 Brnění</span><span>📿 Amulet</span></div></div>
                <div className="board-section"><b>🩹 Zranění a únava</b><div className="condition-row"><span>Zranění</span><strong>0 / 4</strong></div><div className="condition-track"><i style={{width:"0%"}} /></div><div className="condition-row"><span>Únava</span><strong>0 / 2</strong></div><div className="condition-track fatigue"><i style={{width:"0%"}} /></div></div>
                <div className="board-section board-stats"><b>🐉 Dračí přízeň a osobní statistiky</b><p>Dračí přízeň: 0</p><p>Objevené hexagony: 0 · Postavené budovy: 0</p></div>
              </>
            ) : (
              <>
                <div className="board-section"><b>🎲 Přehled akcí</b><p>Průzkum · Pohyb · Stavba · Vylepšení · Obchod · Léčení · Odpočinek</p></div>
                <div className="board-section"><b>🧭 Základní pravidla tahu</b><p>{isSolo ? "V sólo hře máš 4 akce za kolo. Každou akci provedeš samostatně." : "V multiplayeru má každý hráč 2 akce za kolo. Každá akce se provede samostatně."}</p></div>
                <div className="board-section"><b>🗺️ Symboly a terény</b><p>🌲 Les – dřevo · ⛰️ Skály – kámen · 🌼 Louka – farma · 💧 Voda – rybář</p></div>
                <div className="board-section"><b>❤️ Léčení a odpočinek</b><p>Bylina: 1 zranění · Lektvar: 2 zranění · Krystal: 3 zranění. Odpočinek odstraní 1 únavu.</p></div>
              </>
            )}
          </section>

          <section className="mini-panel merchant-card">
            <div className="mini-heading"><span>🧺</span><div><small>SAMOSTATNÁ POMŮCKA</small><h3>Ceník kupce</h3></div></div>
            <div className="merchant-rate"><span>3 🪵 / 3 🪨 / 3 🍎</span><strong>→ 1 🪙</strong></div>
            <p className="capacity-note">Potvrzená směna: tři kusy dřeva, kamene nebo jídla za jedno zlato.</p>
            <p className="merchant-note">Další nákupní a směnné kurzy doplníme až po jejich schválení.</p>
          </section>
        </aside>
      </div>
      <footer className="preview-footer">{isSolo ? "Sólo testovací režim · 1 hráč · 4 akce za kolo" : "Multiplayerový náhled · 2–6 hráčů · 2 akce na hráče"} • Změny v tomto náhledu se neukládají ani nesynchronizují.</footer>
    </main>
  );
}
