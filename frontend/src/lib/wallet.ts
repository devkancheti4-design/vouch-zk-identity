/**
 * The holder's wallet, in their own browser.
 *
 * Two things live here and nowhere else: the secret that binds credentials to this person, and
 * the credentials themselves. Neither is ever sent anywhere. Clearing site data is the same as
 * losing the wallet, which is exactly what it should be.
 *
 * Both live in ONE key, written in one call. They used to be two keys written minutes apart --
 * the secret on first load, the credential after issuance -- which meant a browser that evicted
 * one and kept the other (Safari caps script-written storage at seven days) left a credential
 * that could never be proven again, because the secret binding it to this holder was gone.
 * A single record cannot tear that way: either the whole wallet is there or none of it is.
 */
import type { Credential } from "./credential";

const KEY = "vouch.wallet";
const LEGACY_SECRET = "vouch.secret";
const LEGACY_CRED = "vouch.credential";
const VERSION = 1;

export interface WalletRecord {
  v: number;
  /** decimal string: a field element, not a JS number */
  secret: string;
  credential?: Credential;
  createdAt: string;
}

/** a 253-bit secret, small enough to be a BabyJubJub field element */
function freshSecret(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v.toString();
}

/** Reject anything that would crash a later BigInt() or witness build. */
function validate(r: unknown): WalletRecord | undefined {
  if (!r || typeof r !== "object") return undefined;
  const w = r as Partial<WalletRecord>;
  if (typeof w.secret !== "string" || !/^[0-9]+$/.test(w.secret)) return undefined;
  try { if (BigInt(w.secret) <= 0n) return undefined; } catch { return undefined; }
  const c = w.credential;
  if (c !== undefined) {
    const ok = c && typeof c === "object"
      && typeof c.subject === "string" && typeof c.sigS === "string"
      && typeof c.sigR8x === "string" && typeof c.sigR8y === "string"
      && Number.isFinite(c.dobDays) && Number.isFinite(c.expiresAt);
    if (!ok) return { v: VERSION, secret: w.secret, createdAt: w.createdAt ?? new Date().toISOString() };
  }
  return { v: VERSION, secret: w.secret, credential: c, createdAt: w.createdAt ?? new Date().toISOString() };
}

function write(r: WalletRecord) {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode: wallet is session-only */ }
}

/** Read the wallet, migrating a pre-v1 two-key wallet in place. Creates one if there is none. */
export function loadWallet(): WalletRecord {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw) {
    try {
      const parsed = validate(JSON.parse(raw));
      if (parsed) return parsed;
    } catch { /* corrupt JSON falls through to migration, then to a fresh wallet */ }
  }

  // pre-v1: secret and credential under separate keys
  let legacySecret: string | null = null, legacyCred: string | null = null;
  try {
    legacySecret = localStorage.getItem(LEGACY_SECRET);
    legacyCred = localStorage.getItem(LEGACY_CRED);
  } catch { /* storage blocked */ }
  if (legacySecret && /^[0-9]+$/.test(legacySecret)) {
    let credential: Credential | undefined;
    if (legacyCred) { try { credential = JSON.parse(legacyCred) as Credential; } catch { /* drop it */ } }
    const migrated = validate({ v: VERSION, secret: legacySecret, credential, createdAt: new Date().toISOString() });
    if (migrated) {
      write(migrated);
      try { localStorage.removeItem(LEGACY_SECRET); localStorage.removeItem(LEGACY_CRED); } catch { /* ignore */ }
      return migrated;
    }
  }

  const fresh: WalletRecord = { v: VERSION, secret: freshSecret(), createdAt: new Date().toISOString() };
  write(fresh);
  return fresh;
}

export function holderSecret(): bigint {
  return BigInt(loadWallet().secret);
}

export function loadCredential(): Credential | undefined {
  return loadWallet().credential;
}

/** One write: the credential is never stored without the secret that binds it. */
export function saveCredential(c: Credential) {
  const w = loadWallet();
  write({ ...w, credential: c });
}

export function clearWallet() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_SECRET);
    localStorage.removeItem(LEGACY_CRED);
  } catch { /* ignore */ }
}

/**
 * The only supported way to move a wallet between browsers: the holder carries the file.
 * It contains the secret in the clear, so it is as sensitive as the credential itself --
 * which is the honest trade. There is no server-side copy to fall back on, by design.
 */
export function exportWallet(): { filename: string; json: string } {
  const w = loadWallet();
  return {
    filename: `vouch-wallet-${w.credential?.subject.slice(0, 8) ?? "empty"}.json`,
    json: JSON.stringify(w, null, 2),
  };
}

export function downloadWallet() {
  const { filename, json } = exportWallet();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Returns an error string on a file that is not a wallet, rather than wiping a good one. */
export function importWallet(json: string): string | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return "That file is not valid JSON."; }
  const r = validate(parsed);
  if (!r) return "That file is not a VOUCH wallet backup.";
  write(r);
  return undefined;
}

/** which wallet address this browser uses to submit proofs (demo: a fixed dev account) */
export const HOLDER_WALLET_INDEX = 1;
