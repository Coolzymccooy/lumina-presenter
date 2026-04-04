import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { MacroDefinition } from '../types/macros';

// ─── Firestore path helper ────────────────────────────────────────────────────

const macrosRef = (workspaceId: string) =>
  collection(db, 'workspaces', workspaceId, 'macros');

const macroDocRef = (workspaceId: string, macroId: string) =>
  doc(db, 'workspaces', workspaceId, 'macros', macroId);

// ─── Runtime sanitiser ───────────────────────────────────────────────────────

function isValidMacro(data: unknown): data is MacroDefinition {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'string' && d.id.length > 0 &&
    typeof d.name === 'string' && d.name.length > 0 &&
    Array.isArray(d.triggers) &&
    Array.isArray(d.actions)
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function loadMacros(workspaceId: string): Promise<MacroDefinition[]> {
  const q = query(macrosRef(workspaceId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data()).filter(isValidMacro);
}

/**
 * Subscribe to real-time macro updates for a workspace.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeMacros(
  workspaceId: string,
  onUpdate: (macros: MacroDefinition[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(macrosRef(workspaceId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snapshot => {
      const macros = snapshot.docs.map(d => d.data()).filter(isValidMacro);
      onUpdate(macros);
    },
    err => {
      if (onError) onError(err);
    },
  );
}

// ─── Firestore sanitiser ─────────────────────────────────────────────────────

/**
 * Recursively remove `undefined` values from a plain object so Firestore
 * doesn't reject the document with "Unsupported field value: undefined".
 */
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return obj;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveMacro(
  workspaceId: string,
  macro: MacroDefinition,
): Promise<void> {
  await setDoc(macroDocRef(workspaceId, macro.id), stripUndefined(macro), { merge: true });
}

export async function deleteMacro(
  workspaceId: string,
  macroId: string,
): Promise<void> {
  await deleteDoc(macroDocRef(workspaceId, macroId));
}

// ─── Seed helper ─────────────────────────────────────────────────────────────

/**
 * Seeds starter macros for a workspace if none exist yet.
 * Safe to call on every workspace init — only writes when the collection is empty.
 */
export async function seedStarterMacrosIfEmpty(
  workspaceId: string,
  starters: MacroDefinition[],
): Promise<void> {
  const existing = await loadMacros(workspaceId);
  if (existing.length > 0) return;
  for (const macro of starters) {
    await saveMacro(workspaceId, macro);
  }
}
