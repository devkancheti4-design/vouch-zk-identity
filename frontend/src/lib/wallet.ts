/**
 * The holder's wallet, in their own browser.
 *
 * Two things live here and nowhere else: the secret that binds credentials to this person, and
 * the credentials themselves. Neither is ever sent anywhere. Clearing site data is the same as
 * losing the wallet, which is exactly what it should be.
 */
import type { Credential } from "./credential";

const SECRET_KEY = "vouch.secret";
const CRED_KEY = "vouch.credential";

/** a 253-bit secret, small enough to be a BabyJubJub field element */
export function holderSecret(): bigint {
  const existing = localStorage.getItem(SECRET_KEY);
  if (existing) return BigInt(existing);
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  localStorage.setItem(SECRET_KEY, v.toString());
  return v;
}

export function loadCredential(): Credential | undefined {
  const raw = localStorage.getItem(CRED_KEY);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Credential; } catch { return undefined; }
}

export function saveCredential(c: Credential) {
  localStorage.setItem(CRED_KEY, JSON.stringify(c));
}

export function clearWallet() {
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(SECRET_KEY);
}

/** which wallet address this browser uses to submit proofs (demo: a fixed dev account) */
export const HOLDER_WALLET_INDEX = 1;
