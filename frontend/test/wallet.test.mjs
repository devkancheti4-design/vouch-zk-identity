import { strict as a } from "node:assert";
import test from "node:test";

// a localStorage that behaves like the browser's: strings only, throws when blocked
class LS {
  constructor(blocked = false) { this.m = new Map(); this.blocked = blocked; }
  getItem(k) { if (this.blocked) throw new Error("blocked"); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.blocked) throw new Error("blocked"); this.m.set(k, String(v)); }
  removeItem(k) { if (this.blocked) throw new Error("blocked"); this.m.delete(k); }
}

const CRED = {
  subject: "12345678901234567890", msg: "1", sigR8x: "2", sigR8y: "3", sigS: "4",
  issuerName: "Acme Bank", dobDays: 9000, balance: 50000, countryCode: 826, flags: 1, expiresAt: 30000,
};

async function fresh(ls) {
  globalThis.localStorage = ls;
  // cache-bust so module-level state never leaks between cases
  return import(`../src/lib/wallet.ts?${Math.random()}`);
}

test("a new browser gets a valid secret and persists it across reloads", async () => {
  const ls = new LS();
  let w = await fresh(ls);
  const s1 = w.holderSecret();
  a.ok(s1 > 0n, "secret is a positive field element");
  a.equal(w.loadCredential(), undefined);
  w = await fresh(ls);
  a.equal(w.holderSecret(), s1, "same secret after a reload");
  a.equal(ls.m.size, 1, "exactly one key, not two");
});

test("saving a credential never writes it without the secret", async () => {
  const ls = new LS();
  const w = await fresh(ls);
  const s = w.holderSecret();
  w.saveCredential(CRED);
  a.equal(ls.m.size, 1, "still one atomic record");
  const rec = JSON.parse(ls.m.get("vouch.wallet"));
  a.equal(rec.secret, s.toString());
  a.equal(rec.credential.subject, CRED.subject, "credential and secret in the same write");
});

test("a pre-v1 two-key wallet migrates without losing the credential", async () => {
  const ls = new LS();
  ls.setItem("vouch.secret", "7788990011223344556677889900");
  ls.setItem("vouch.credential", JSON.stringify(CRED));
  const w = await fresh(ls);
  a.equal(w.holderSecret(), 7788990011223344556677889900n, "old secret survives");
  a.equal(w.loadCredential().subject, CRED.subject, "old credential survives");
  a.equal(ls.m.has("vouch.secret"), false, "legacy keys removed");
  a.equal(ls.m.has("vouch.credential"), false);
});

test("an orphaned legacy credential (secret evicted) does not resurrect as unprovable", async () => {
  const ls = new LS();
  ls.setItem("vouch.credential", JSON.stringify(CRED)); // secret gone, as Safari would leave it
  const w = await fresh(ls);
  a.ok(w.holderSecret() > 0n, "a fresh secret is minted");
  a.equal(w.loadCredential(), undefined, "the unprovable credential is not carried forward");
});

test("corrupt JSON falls back to a working wallet instead of throwing", async () => {
  const ls = new LS();
  ls.setItem("vouch.wallet", "{ this is not json");
  const w = await fresh(ls);
  a.ok(w.holderSecret() > 0n, "recovers");
});

test("a record with a non-numeric secret is rejected, not loaded", async () => {
  const ls = new LS();
  ls.setItem("vouch.wallet", JSON.stringify({ v: 1, secret: "not-a-number", credential: CRED }));
  const w = await fresh(ls);
  a.ok(w.holderSecret() > 0n);
  a.equal(w.loadCredential(), undefined, "credential bound to a bad secret is dropped");
});

test("a half-written credential is dropped but the secret is kept", async () => {
  const ls = new LS();
  ls.setItem("vouch.wallet", JSON.stringify({ v: 1, secret: "42", credential: { subject: "x" } }));
  const w = await fresh(ls);
  a.equal(w.holderSecret(), 42n, "secret survives a bad credential");
  a.equal(w.loadCredential(), undefined, "malformed credential is not returned");
});

test("export then import round-trips into a different browser", async () => {
  const lsA = new LS();
  let w = await fresh(lsA);
  const secret = w.holderSecret();
  w.saveCredential(CRED);
  const { json, filename } = w.exportWallet();
  a.match(filename, /^vouch-wallet-\d{8}\.json$/);

  const lsB = new LS();               // a second browser, empty
  w = await fresh(lsB);
  const before = w.holderSecret();
  a.notEqual(before, secret, "starts as a different wallet");
  a.equal(w.importWallet(json), undefined, "import reports no error");
  a.equal(w.holderSecret(), secret, "secret restored");
  a.equal(w.loadCredential().subject, CRED.subject, "credential restored");
});

test("importing a junk file reports an error and leaves the good wallet intact", async () => {
  const ls = new LS();
  const w = await fresh(ls);
  w.saveCredential(CRED);
  const good = w.holderSecret();
  a.match(w.importWallet("<html>nope</html>"), /not valid JSON/);
  a.match(w.importWallet(JSON.stringify({ hello: "world" })), /not a VOUCH wallet/);
  a.equal(w.holderSecret(), good, "existing wallet untouched");
  a.equal(w.loadCredential().subject, CRED.subject);
});

test("blocked storage (private mode) still yields a usable session wallet", async () => {
  const w = await fresh(new LS(true));
  a.ok(w.holderSecret() > 0n, "does not throw when localStorage is unavailable");
  w.saveCredential(CRED);
  w.clearWallet();
});
