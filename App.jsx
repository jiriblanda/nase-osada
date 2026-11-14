import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db, ensureSignedIn } from "./firebase.js";

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
            memberUids: [user.uid],
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
      setMessage("Místnost byla vytvořena.");
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
        if (data.players?.some((player) => player.uid === user.uid)) return;
        if (data.status !== "waiting" || (data.players?.length ?? 0) >= 6) {
          throw new Error("Tato místnost je už plná nebo hra začala.");
        }
        const nextPlayers = [...(data.players || []), {
          uid: user.uid,
          name: nickname.trim() || `Hráč ${(data.players?.length || 0) + 1}`
        }];
        transaction.update(roomRef, {
          players: nextPlayers,
          memberUids: [...(data.memberUids || data.players.map((player) => player.uid)), user.uid],
          status: "waiting"
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
  const isHost = !!room && !!user && room.hostUid === user.uid;

  async function startGame() {
    if (!user || !roomCode || !isHost) return;
    setBusy(true);
    setError("");
    try {
      const roomRef = doc(db, "rooms", roomCode);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) throw new Error("Místnost už neexistuje.");
        const data = snapshot.data();
        if (data.hostUid !== user.uid) throw new Error("Hru může spustit pouze zakladatel místnosti.");
        if (data.status !== "waiting") throw new Error("Hra už byla spuštěna nebo místnost není otevřená.");
        if ((data.players?.length ?? 0) < 2) throw new Error("Ke spuštění jsou potřeba alespoň dva hráči.");
        transaction.update(roomRef, { status: "playing", startedAt: serverTimestamp() });
      });
      setMessage("Hra byla spuštěna. Sestava hráčů je uzamčena.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Hru se nepodařilo spustit.");
    } finally {
      setBusy(false);
    }
  }

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
      </section>

      {room && isMember && (
        <section className="panel room-panel">
          <div className="room-title">
            <div>
              <p className="eyebrow">HERNÍ MÍSTNOST</p>
              <h2>{`Připojeno ${room.players?.length || 0} z 6 hráčů`}</h2>
            </div>
            <span className={`state ${room.status}`}>{room.status === "playing" ? "HRA SPUŠTĚNA" : "ČEKÁNÍ"}</span>
          </div>
          <p className="code-label">KÓD PRO OSTATNÍ HRÁČE</p>
          <div className="code">{room.code}</div>
          <button className="copy" onClick={() => navigator.clipboard?.writeText(room.code)}>Kopírovat kód</button>
          <div className="players">
            {room.players?.map((player, index) => (
              <div className="player" key={player.uid}>
                <div className="avatar">{index + 1}</div>
                <div><strong>{player.name}</strong><small>{player.uid === user.uid ? "Toto zařízení" : `Hráč ${index + 1}`}</small></div>
                <span className="online">● připojen</span>
              </div>
            ))}
            {Array.from({ length: room.status === "waiting" ? Math.max(0, 6 - (room.players?.length || 0)) : 0 }, (_, index) => (
              <div className="player waiting" key={`empty-${index}`}><div className="avatar">?</div><div><strong>Volné místo</strong><small>Čeká na dalšího hráče</small></div></div>
            ))}
          </div>
          {room.status === "playing" ? (
            <div className="success">Hra byla spuštěna pro {room.players?.length} {room.players?.length === 2 ? "hráče" : room.players?.length < 5 ? "hráče" : "hráčů"}. Sestava je uzamčena a další hráči se už nemohou připojit.</div>
          ) : (
            <>
              <div className="success">Pošli kód ostatním. Můžete hrát ve 2, 3, 4, 5 nebo 6 hráčích. Na šestého čekat nemusíte.</div>
              {isHost && (
                <button className="primary" onClick={startGame} disabled={busy || (room.players?.length || 0) < 2}>
                  {busy ? "Spouštím…" : `▶ Spustit hru (${room.players?.length || 0}/6 hráčů)`}
                </button>
              )}
              {isHost && (room.players?.length || 0) < 2 && <p className="status">Ke spuštění se musí připojit alespoň druhý hráč.</p>}
              {!isHost && <p className="status">Čekáme, až zakladatel místnosti spustí hru.</p>}
            </>
          )}
        </section>
      )}

      <footer>Naše osada <span>•</span> První testovací verze</footer>
    </main>
  );
}