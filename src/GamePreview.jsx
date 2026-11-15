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

export default function GamePreview({ onBack }) {
  const [revealed, setRevealed] = useState(["0,0"]);
  const [position, setPosition] = useState("0,0");
  const [actions, setActions] = useState(2);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState("Vydej se na sousední políčko a odhal, co se skrývá v krajině.");
  const [resources, setResources] = useState({ wood: 2, stone: 2, food: 2, water: 1, gold: 0 });

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
    setActions(2);
    setMessage("Začíná nové kolo. V ukázce se nyní obnovily 2 akce.");
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
        <div className="preview-brand"><span>⌂</span><div><small>TESTOVACÍ REŽIM</small><h1>Naše osada</h1></div></div>
        <div className="round-pill">Kolo {round}</div>
      </header>

      <section className="preview-intro">
        <div><p className="preview-kicker">PRVNÍ HERNÍ NÁHLED</p><h2>Začíná dobrodružství</h2><p>Prozkoumej okolí společného stanu a připrav místo pro svou osadu.</p></div>
        <div className="action-counter"><strong>{actions}</strong><span>akce zbývají</span></div>
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

          <section className="mini-panel player-card">
            <div className="mini-heading"><span>🧑‍🌾</span><div><small>HRÁČSKÁ KARTIČKA</small><h3>Tvůj osadník</h3></div></div>
            <div className="player-status"><span className="player-dot" /> Hráč 1 <span className="player-color">●</span></div>
            <div className="card-section"><b>🎒 Batoh</b><p>Zatím prázdný – nalezené předměty se zobrazí zde.</p></div>
            <div className="card-section"><b>⚔️ Výbava</b><p>Zbraň · Štít · Brnění · Amulet</p></div>
            <div className="card-section"><b>🩹 Stav</b><p>Zranění: 0/4 <span>Únava: 0/2</span></p></div>
            <div className="card-section"><b>🧺 Ceník kupce</b><p>3 dřeva / kameny / jídla = 1 zlato</p><small>Ostatní směnné kurzy doplníme po jejich schválení.</small></div>
          </section>
        </aside>
      </div>
      <footer className="preview-footer">Náhled herních prvků • Změny v tomto režimu se neukládají ani nesynchronizují.</footer>
    </main>
  );
}
