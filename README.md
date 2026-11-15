# Naše osada

První základní verze společné online hry.

## Co zatím umí
- anonymní přihlášení přes Firebase Authentication,
- vytvoření herní místnosti,
- připojení druhého hráče pomocí šestimístného kódu,
- živé zobrazení hráčů v místnosti přes Firestore.

## Spuštění
1. Nainstaluj Node.js (verze 18 nebo novější).
2. V této složce spusť `npm install`.
3. Spusť `npm run dev`.

## Firebase
Projekt používá Firebase projekt `nase-osada`.
V Firebase Console:
- Authentication → Sign-in method → Anonymous musí být zapnuté.
- Firestore Database → Rules: vlož obsah souboru `firestore.rules` a publikuj.

Webová konfigurace Firebase je v `src/firebase.js`. Neobsahuje administrátorský klíč.
