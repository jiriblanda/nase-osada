import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db, ensureSignedIn } from "./firebase.js";
import GamePreview from "./GamePreview.jsx";

const MAX_PLAYERS = 6;

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function App() {
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Připravuji připojení…");
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let active = true;
    ensureSignedIn()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setMessage("Připojeno k Firebase.");
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setError("Nepodařilo se přihlásit. Zkontroluj anonymní přihlášení ve Firebase Authentication.");
          setMessage("Připojení se nezdařilo.");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "rooms", roomCode),
      (snapshot) => {
        if (snapshot.exists()) {
          setRoom({ id: snapshot.id, ...snapshot.data() });
          setError("");
        } else {
          setRoom(null);
        }
      },
      (err) => {
        console.error(err);
        setError("Nemám přístup k této místnosti. Zkontroluj pravidla Firestore.");
      }
    );
    return unsubscribe;
  }, [roomCode]);

  async function createRoom() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      let code = makeRoomCode();
      let created = false;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const roomRef = doc(db, "rooms", code);
        try {
          await setDoc(roomRef, {
            code,
            hostUid: user.uid,
            players: [{ uid: user.uid, name: nickname.trim() || "Hráč 1" }],
            status: "waiting",
            round: 1,
            actionsPerPlayer: 2,
            createdAt: serverTimestamp()
          });
          created = true;
        } catch (err) {
          if (err.code !== "permission-denied" && err.code !== "already-exists") throw err;
          code = makeRoomCode();
        }
      }
      if (!created) throw new Error("Nepodařilo se vytvořit jedinečný kód místnosti.");
      setRoomCode(code);
      setRoomInput(code);
      setMessage("Místnost byla vytvořena. Můžeš pozvat až dalších 5 hráčů.");
    } catch (err) {
      console.error(err);
      setError("Místnost se nepodařilo vytvořit. Zkontroluj nastavení Firestore a jeho pravidla.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!user) return;
    const code = roomInput.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      setError("Kód musí mít 6 znaků.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const roomRef = doc(db, "rooms", code);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) throw new Error("Místnost s tímto kódem neexistuje.");
        const data = snapshot.data();
        const players = Array.isArray(data.players) ? data.players : [];
        if (players.some((player) => player.uid === user.uid)) return;
        if (data.status !== "waiting") throw new Error("Tato hra už začala.");
        if (players.length >= MAX_PLAYERS) throw new Error("Místnost je plná. Maximální počet je 6 hráčů.");
        transaction.update(roomRef, {
          players: [...players, {
            uid: user.uid,
            name: nickname.trim() || `Hráč ${players.length + 1}`
          }]
        });
      });
      setRoomCode(code);
      setMessage("Připojeno k místnosti.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Do místnosti se nepodařilo připojit.");
    } finally {
      setBusy(false);
    }
  }

  const isMember = !!room && !!user && room.players?.some((player) => player.uid === user.uid);
  const playerCount = room?.players?.length ?? 0;

  if (showPreview) return <GamePreview onBack={() => setShowPreview(false)} />;

  return (
    <main className="page">
      <header className="top">
        <div className="mark">⌂</div>
        <div>
          <p className="eyebrow">SPOLEČNÁ STRATEGICKÁ HRA</p>
          <h1>Naše osada</h1>
          <p className="sub">Vybudujte osadu společně. Tah za tahem.</p>
        </div>
      </header>

      <section className="panel">
        <div className="section-heading">
          <span className="dot" />
          <span>{user ? "Připojení aktivní" : "Připojuji…"}</span>
        </div>
        <label htmlFor="nickname">Jak ti máme říkat?</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={20}
          placeholder="Tvoje jméno ve hře"
        />
        <div className="divider"><span>VYTVOŘIT NEBO SE PŘIPOJIT</span></div>
        <button className="primary" onClick={createRoom} disabled={!user || busy}>
          {busy ? "Pracuji…" : "＋  Vytvořit novou místnost"}
        </button>
        <div className="join-row">
          <input
            value={roomInput}
            onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Šestimístný kód"
            aria-label="Kód místnosti"
          />
          <button className="secondary" onClick={joinRoom} disabled={!user || busy}>Připojit</button>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="status">{message}</p>
        <button className="preview-launch" onClick={() => setShowPreview(true)}>
          ✦  Prohlédnout herní náhled
        </button>
      </section>

      {room && isMember && (
        <section className="panel room-panel">
          <div className="room-title">
            <div>
              <p className="eyebrow">HERNÍ MÍSTNOST</p>
              <h2>Čekáme na hráče ({playerCount}/{MAX_PLAYERS})</h2>
            </div>
            <span className="state waiting">ČEKÁNÍ</span>
          </div>
          <p className="code-label">KÓD PRO OSTATNÍ HRÁČE</p>
          <div className="code">{room.code}</div>
          <button className="copy" onClick={() => navigator.clipboard?.writeText(room.code)}>Kopírovat kód</button>
          <div className="players">
            {Array.from({ length: MAX_PLAYERS }, (_, index) => {
              const player = room.players?.[index];
              return (
                <div className={player ? "player" : "player waiting"} key={player?.uid || `empty-${index}`}>
                  <div className="avatar">{player ? index + 1 : "?"}</div>
                  <div>
                    <strong>{player ? player.name : "Volné místo"}</strong>
                    <small>{player ? (player.uid === user.uid ? "Toto zařízení" : "Připojený hráč") : "Čeká na hráče"}</small>
                  </div>
                  {player && <span className="online">● připojen</span>}
                </div>
              );
            })}
          </div>
          {playerCount === MAX_PLAYERS ? (
            <div className="success">Místnost je plná! Všech šest hráčů je připojeno.</div>
          ) : (
            <div className="success">Místnost je připravena pro 1 až 6 hráčů. Hru lze později rozšířit i o samostatné hraní.</div>
          )}
        </section>
      )}

      <footer>Naše osada <span>•</span> První testovací verze</footer>
    </main>
  );
}