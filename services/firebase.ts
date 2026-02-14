import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, collection, query, where, orderBy } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10;
};

export const subscribeToState = (callback: (data: any) => void, sessionId = 'live') => {
  return onSnapshot(doc(db, 'sessions', sessionId), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.data());
  });
};

export const updateLiveState = async (state: any, sessionId = 'live') => {
  try {
    await setDoc(doc(db, 'sessions', sessionId), {
      ...state,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.error("Sync Error:", e);
  }
};

export const subscribeToTeamPlaylists = (teamId: string, callback: (data: any[]) => void) => {
  const playlistQuery = query(
    collection(db, 'playlists'),
    where('teamId', '==', teamId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(playlistQuery, (snapshot) => {
    callback(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
  });
};

export const upsertTeamPlaylist = async (teamId: string, playlistId: string, payload: any) => {
  await setDoc(doc(db, 'playlists', playlistId), {
    teamId,
    ...payload,
    updatedAt: Date.now(),
  }, { merge: true });
};

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);
