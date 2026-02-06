
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDzEt6scke_SnD9ee6AgCcf_y38lUppDn0",
  authDomain: "lumina-91144.firebaseapp.com",
  projectId: "lumina-91144",
  storageBucket: "lumina-91144.firebasestorage.app",
  messagingSenderId: "161399880211",
  appId: "1:161399880211:web:f5d4affd057b621cc75de6",
  measurementId: "G-C0P1C211PM"
};

export const isFirebaseConfigured = Boolean(firebaseConfig?.apiKey);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// --- Sync Helpers ---

export const subscribeToState = (callback: (data: any) => void) => {
  return onSnapshot(doc(db, 'sessions', 'live'), (doc) => {
    if (doc.exists()) callback(doc.data());
  });
};

export const updateLiveState = async (state: any) => {
  try {
    await setDoc(doc(db, 'sessions', 'live'), state, { merge: true });
  } catch (e) {
    console.error("Sync Error:", e);
  }
};

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);
