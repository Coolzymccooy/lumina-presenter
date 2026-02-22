import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore';
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

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    Object.entries(value).forEach(([key, entry]) => {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    });
    return next;
  }
  return value;
};

export const subscribeToState = (
  callback: (data: any) => void,
  sessionId = 'live',
  onError?: (error: any) => void
) => {
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data());
    },
    (error) => {
      if (onError) onError(error);
    }
  );
};

export const updateLiveState = async (state: any, sessionId = 'live') => {
  try {
    const payload = stripUndefinedDeep({
      ...state,
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'sessions', sessionId), payload, { merge: true });
    return true;
  } catch {
    return false;
  }
};

export const subscribeToTeamPlaylists = (
  teamId: string,
  callback: (data: any[]) => void,
  onError?: (error: any) => void
) => {
  const playlistQuery = query(
    collection(db, 'playlists'),
    where('teamId', '==', teamId)
  );

  return onSnapshot(
    playlistQuery,
    (snapshot) => {
      const rows = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      rows.sort((a: any, b: any) => {
        const left = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const right = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return right - left;
      });
      callback(rows);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
};

export const upsertTeamPlaylist = async (teamId: string, playlistId: string, payload: any) => {
  const nextPayload = stripUndefinedDeep({
    teamId,
    ...payload,
    updatedAt: Date.now(),
  });
  await setDoc(doc(db, 'playlists', playlistId), nextPayload, { merge: true });
};

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);
