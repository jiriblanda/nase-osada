import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Veřejná konfigurace webové aplikace Firebase.
// Bezpečnost databáze zajišťují především Firestore Rules.
const firebaseConfig = {
  apiKey: "AIzaSyBsZV6QsuBPrviNus6FI-hnQ9NbNqcKiQU",
  authDomain: "nase-osada.firebaseapp.com",
  projectId: "nase-osada",
  storageBucket: "nase-osada.firebasestorage.app",
  messagingSenderId: "707833490471",
  appId: "1:707833490471:web:965e4f178f9267f720b202",
  measurementId: "G-ZQ6RGY6836"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}