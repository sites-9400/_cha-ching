import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

const EMAIL = "vault@cha-ching.app";
const PEPPER = "chaching-2026-x7-pepper";

const toPassword = (pin: string) => `${pin}:${PEPPER}`;

/** Sign in with an existing PIN. Throws Firebase auth errors on failure. */
export async function unlock(pin: string): Promise<void> {
  await signInWithEmailAndPassword(auth, EMAIL, toPassword(pin));
}

/** First-run only: create the hidden account from a new PIN. */
export async function setupPin(pin: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, EMAIL, toPassword(pin));
}

export async function lock(): Promise<void> {
  await signOut(auth);
}

/** Subscribe to signed-in state; returns unsubscribe. */
export function watchAuth(cb: (signedIn: boolean) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user !== null));
}
