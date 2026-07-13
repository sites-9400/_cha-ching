import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
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

/** Re-authenticate with the current PIN, then set a new one. Throws on wrong current PIN. */
export async function changePin(currentPin: string, newPin: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const cred = EmailAuthProvider.credential(EMAIL, toPassword(currentPin));
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, toPassword(newPin));
}

/** Subscribe to signed-in state; returns unsubscribe. */
export function watchAuth(cb: (signedIn: boolean) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user !== null));
}
